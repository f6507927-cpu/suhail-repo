import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { researchDraft, researchPacket, researchReviewEvent, researchSetting, researchUsage } from "../../db/schema/research";
import { analystProfile } from "../../db/schema/accounts";
import { security, company } from "../../db/schema/market";
import { audit, type Tx, type AppUser } from "../auth/audit";
import { withAdminAction } from "../auth/actions";
import { PROMPT_VERSION } from "./prompt";
import { VALIDATOR_VERSION, type ResearchPacket, type ValidationIssue } from "../../ai/research/contracts";
import { hash } from "../../engine/canonical";
import type { JsonValue } from "../../engine/types";
import type { Checklist, ResearchBudget, ResearchState } from "./contracts";
import { assertScope, scopeSettingsSchema } from "./workflow";

export function researchTextHash(value: unknown) {
  return hash(JSON.parse(JSON.stringify(value)) as JsonValue);
}
export async function assertActiveAnalyst(tx: Pick<Tx, "select">, actorId: string) {
  const [profile] = await tx.select({ id: analystProfile.id }).from(analystProfile)
    .where(and(eq(analystProfile.user_id, actorId), eq(analystProfile.active, true)));
  if (!profile) throw new Error("An active analyst profile is required");
}
export async function configuredSettings(db: Pick<Tx, "select"> = dbApp) {
  const [row] = await db.select().from(researchSetting).where(eq(researchSetting.id, 1));
  if (!row) throw new Error("Research settings are unavailable");
  return { row, scope: scopeSettingsSchema.parse({ ...row,
    price_move_threshold_percent: row.price_move_threshold_percent === null ? null : Number(row.price_move_threshold_percent) }) };
}
type Draft = typeof researchDraft.$inferSelect;
export async function recordResearch(tx: Tx, actor: AppUser,
  eventType: "research_requested" | "research_generated" | "research_edited" | "research_transition" | "research_settings" | "research_gate",
  draft: Draft | null, packetHash: string | null, from: ResearchState | null, to: ResearchState | null,
  options: { checklist?: Checklist; edit_reasons?: string[]; note?: string;
    details?: Record<string, JsonValue> } = {}) {
  await tx.insert(researchReviewEvent).values({
    draft_id: draft?.id ?? null, actor_id: actor.id, actor_role: actor.role,
    from_state: from, to_state: to, packet_hash: packetHash,
    model: draft?.model ?? null, model_version: draft?.model_version ?? null,
    prompt_version: draft?.prompt_version ?? PROMPT_VERSION, validator_version: draft?.validator_version ?? VALIDATOR_VERSION,
    text_hash: draft?.text_hash ?? null, checklist: options.checklist ?? null,
    edit_reasons: options.edit_reasons ?? [], note: options.note ?? "",
  });
  await audit(tx, actor, { event_type: eventType, entity_name: draft ? "research_draft" : "research_setting",
    entity_id: draft?.id ?? "1", summary: eventType,
    details: { from, to, packet_hash: packetHash, text_hash: draft?.text_hash ?? null, ...options.details } });
}
/** D-210: only the short DB work is serialised; no provider calls under this lock. */
export async function createRequestedDraft(tx: Tx, actor: AppUser, packet: ResearchPacket, guidance: string, previousId: string | null) {
  await tx.execute(sql`select pg_advisory_xact_lock(73501948)`);
  const { scope } = await configuredSettings(tx);
  const [stock] = await tx.select({ id: security.id, covered: sql<boolean>`${security.coverage_analyst_id} is not null`,
    in_universe: security.in_universe, sector: company.sector_label }).from(security)
    .innerJoin(company, eq(company.id, security.company_id)).where(eq(security.id, packet.security.id));
  if (!stock) throw new Error("Stock unavailable");
  const active = await activeResearchStocks(tx);
  assertScope(scope, stock, active, stock.id);
  if (scope.monthly_token_budget === 0) throw new Error("Research token budget is not configured");
  if (previousId) {
    const [previous] = await tx.select().from(researchDraft).where(eq(researchDraft.id, previousId));
    if (!previous || previous.security_id !== stock.id) throw new Error("Previous draft does not match this stock");
  }
  const [storedPacket] = await tx.insert(researchPacket).values({ security_id: stock.id, payload: packet,
    packet_schema_version: packet.packet_schema_version, packet_hash: packet.packet_hash, built_at: new Date(packet.built_at) }).returning();
  const [draft] = await tx.insert(researchDraft).values({
    security_id: stock.id, packet_id: storedPacket.id, previous_draft_id: previousId, analyst_instructions: guidance,
    prompt_version: PROMPT_VERSION, validator_version: VALIDATOR_VERSION,
    validation_results: [{ check: "not_validated", severity: "block", message: "Generation required", location: "draft" }],
  }).returning();
  await recordResearch(tx, actor, "research_requested", draft, packet.packet_hash, null, "requested");
  return draft;
}
export async function activeResearchStocks(tx: Pick<Tx, "select">) {
  return tx.select({ security_id: researchDraft.security_id, sector: company.sector_label })
    .from(researchDraft).innerJoin(security, eq(security.id, researchDraft.security_id))
    .innerJoin(company, eq(company.id, security.company_id)).where(inArray(researchDraft.state,
      ["requested", "generated", "in_review", "changes_requested", "edited", "approved"]));
}
export async function lockedDraft(tx: Tx, id: string, expectedHash?: string | null) {
  const [draft] = await tx.select().from(researchDraft).where(eq(researchDraft.id, id)).for("update");
  if (!draft) throw new Error("Research draft unavailable");
  if (expectedHash !== undefined && draft.text_hash !== expectedHash) throw new Error("Draft changed; reload before saving");
  const [packet] = await tx.select().from(researchPacket).where(eq(researchPacket.id, draft.packet_id));
  if (!packet) throw new Error("Research packet unavailable");
  return { draft, packet: packet.payload };
}
export async function reserveDraftBudget(tx: Tx, actor: AppUser, draftId: string, month: string, tokens: number) {
  const { draft } = await lockedDraft(tx, draftId);
  if (draft.state !== "requested" || draft.reserved_tokens !== 0 ||
    draft.reservation_attempt !== draft.settled_attempt || draft.reservation_attempt >= 2) return null;
  await tx.insert(researchUsage).values({ month, used: 0, reserved: 0 }).onConflictDoNothing();
  const rows = await tx.update(researchUsage).set({ reserved: sql`${researchUsage.reserved} + ${tokens}` })
    .where(and(eq(researchUsage.month, month), sql`${researchUsage.used} + ${researchUsage.reserved} + ${tokens}
      <= (select monthly_token_budget from app.research_setting where id=1)`)).returning();
  let attempt: number | null = null;
  if (rows.length) {
    attempt = draft.reservation_attempt + 1;
    await tx.update(researchDraft).set({ reserved_tokens: tokens, reservation_month: month,
      reservation_attempt: attempt, attempts: attempt }).where(eq(researchDraft.id, draftId));
  }
  await audit(tx, actor, { event_type: "research_generated", entity_name: "research_usage", entity_id: draftId,
    summary: rows.length ? "research_budget_reserved" : "research_budget_refused", details: { month, tokens, attempt } });
  return attempt;
}
export async function settleDraftBudget(tx: Tx, actor: AppUser, draftId: string, attempt: number, reserved: number, used: number) {
  const { draft } = await lockedDraft(tx, draftId);
  if (draft.reservation_attempt !== attempt || draft.settled_attempt >= attempt) return;
  if (!draft.reservation_month || (draft.reserved_tokens !== reserved &&
    !(draft.state === "failed" && draft.failure_reason === "abandoned" && draft.reserved_tokens === 0)))
    throw new Error("Research budget settlement refused");
  // D-217: a late response after reconciliation charges its actual usage once,
  // without subtracting another draft's reservation or resurrecting this draft.
  const rows = await tx.update(researchUsage).set({ reserved: sql`${researchUsage.reserved} - ${draft.reserved_tokens}`,
    used: sql`${researchUsage.used} + ${used}` }).where(and(eq(researchUsage.month, draft.reservation_month),
      sql`${researchUsage.reserved} >= ${draft.reserved_tokens}`)).returning();
  if (rows.length !== 1) throw new Error("Research budget settlement refused");
  await tx.update(researchDraft).set({ reserved_tokens: 0, settled_attempt: attempt }).where(eq(researchDraft.id, draftId));
  await audit(tx, actor, { event_type: "research_generated", entity_name: "research_usage", entity_id: draftId,
    summary: "research_budget_settled", details: { month: draft.reservation_month, attempt, reserved, used,
      released: draft.reserved_tokens === 0 } });
}
export async function reconcileRequestedDraft(tx: Tx, actor: AppUser, id: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(73501948)`);
  const { draft, packet } = await lockedDraft(tx, id);
  if (draft.state === "failed" && draft.failure_reason === "abandoned") return;
  if (draft.state !== "requested") throw new Error("Only requested drafts can be reconciled");
  if (draft.reserved_tokens > 0) {
    const rows = await tx.update(researchUsage).set({ reserved: sql`${researchUsage.reserved} - ${draft.reserved_tokens}` })
      .where(and(eq(researchUsage.month, draft.reservation_month!),
        sql`${researchUsage.reserved} >= ${draft.reserved_tokens}`)).returning();
    if (rows.length !== 1) throw new Error("Reservation release refused; no changes made");
  }
  const [saved] = await tx.update(researchDraft).set({ state: "failed", failure_reason: "abandoned", reserved_tokens: 0 })
    .where(eq(researchDraft.id, id)).returning();
  await recordResearch(tx, actor, "research_transition", saved, packet.packet_hash, "requested", "failed",
    { note: "abandoned", details: { reason: "abandoned", released_tokens: draft.reserved_tokens, month: draft.reservation_month } });
}
export function actorBudget(draftId: string, clock: string): ResearchBudget {
  const month = `${clock.slice(0, 7)}-01`;
  let attempt: number | null = null;
  return {
    reserve: tokens => withAdminAction(["admin", "editor"], async (tx, actor) => {
      attempt = await reserveDraftBudget(tx, actor, draftId, month, tokens);
      return attempt !== null;
    }),
    settle: (reserved, used) => withAdminAction(["admin", "editor"], async (tx, actor) => {
      if (attempt === null) throw new Error("No draft reservation to settle");
      await settleDraftBudget(tx, actor, draftId, attempt, reserved, used);
    }),
  };
}
export function blockingCount(issues: ValidationIssue[]) {
  return issues.filter(issue => issue.severity === "block").length;
}
