"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "../auth/guards";
import { withAdminAction } from "../auth/actions";
import { dbApp } from "../../db/app";
import { company } from "../../db/schema/market";
import { researchDraft } from "../../db/schema/research";
import { assembleDraft, modelDraftSchema } from "../../ai/research/draft";
import { validateGuidance, validateResearchDraft } from "../../ai/research/validators";
import { loadResearchPacket } from "./loader";
import { actorBudget, assertActiveAnalyst, blockingCount, configuredSettings, createRequestedDraft,
  lockedDraft, recordResearch, researchTextHash, reconcileRequestedDraft, researchWriteLock, saveResearchGeneration } from "./store";
import { updateResearchGate, updateResearchSettings } from "./settings";
import { generateResearch } from "./generate";
import { AnthropicResearchClient } from "./anthropic-client";
import { CHECKLIST, EDIT_REASONS, RESEARCH_STATES, type Checklist, type ResearchRequest } from "./contracts";
import { assertGateEvidence, assertTransition, scopeSettingsSchema } from "./workflow";
import { createRefreshRequest } from "./refresh";
import { clearAnalystViewReview } from "./stale-store";

type ResearchActionResult = { ok: boolean; message?: string; id?: string };
const uuid = z.uuid();
const roles = ["admin", "editor"] as const;
function errorResult(): ResearchActionResult {
  // No SDK/SQL/schema error messages, evidence or request bodies go to the client.
  return { ok: false, message: "Request failed; reload and check your permissions, settings and validation results." };
}
function refresh() {
  revalidatePath("/[locale]/admin/research", "layout");
}
function expectedHash(form: FormData) { return z.string().nullable().parse(form.get("text_hash") || null); }
async function validationSettings(securityId: string, now: string) {
  const { scope } = await configuredSettings();
  const issuers = await dbApp.select({ name: company.name }).from(company).where(eq(company.is_demo, false));
  return { now, max_packet_age_days: scope.max_packet_age_days, max_financial_age_days: scope.max_financial_age_days,
    latest_packet: await loadResearchPacket(securityId, now), known_issuers: issuers.map(row => row.name) };
}
async function completeGeneration(draftId: string, request: ResearchRequest, settings: Awaited<ReturnType<typeof validationSettings>>) {
  const generated = await generateResearch(new AnthropicResearchClient(), request, actorBudget(draftId, settings.now), settings);
  await withAdminAction(roles, (tx, actor) => saveResearchGeneration(tx, actor, draftId, generated));
  refresh();
  return { ok: true, id: draftId, message: generated.state === "failed" ? `Generation failed: ${generated.reason}` : undefined };
}

export async function requestResearchDraft(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const env = AnthropicResearchClient.assertConfigured();
    const id = uuid.parse(form.get("security_id"));
    const previousId = form.get("previous_draft_id") ? uuid.parse(form.get("previous_draft_id")) : null;
    const guidance = z.string().max(2000).parse(form.get("guidance") ?? "");
    if (validateGuidance(guidance).length) return { ok: false, message: "Remove personal contact information from guidance." };
    const settings = await validationSettings(id, new Date().toISOString());
    const packet = settings.latest_packet;
    const draft = await withAdminAction(roles, (tx, actor) => createRequestedDraft(tx, actor, packet, guidance, previousId));
    return await completeGeneration(draft.id, { packet, guidance, max_input_tokens: env.AI_RESEARCH_MAX_INPUT_TOKENS,
      max_output_tokens: env.AI_RESEARCH_MAX_OUTPUT_TOKENS }, settings);
  } catch { return errorResult(); }
}
export async function requestResearchRefresh(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const env = AnthropicResearchClient.assertConfigured();
    const previousId = uuid.parse(form.get("draft_id"));
    const [previous] = await dbApp.select({ security_id: researchDraft.security_id }).from(researchDraft).where(eq(researchDraft.id, previousId));
    if (!previous) return errorResult();
    const settings = await validationSettings(previous.security_id, new Date().toISOString());
    const packet = settings.latest_packet;
    const { draft, refresh: revision } = await withAdminAction(roles, (tx, actor) => createRefreshRequest(tx, actor, packet, previousId));
    return await completeGeneration(draft.id, { packet, refresh: revision, guidance: "",
      max_input_tokens: env.AI_RESEARCH_MAX_INPUT_TOKENS, max_output_tokens: env.AI_RESEARCH_MAX_OUTPUT_TOKENS }, settings);
  } catch { return errorResult(); }
}
export async function confirmResearchAnalystView(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const id = uuid.parse(form.get("draft_id"));
    const run = uuid.parse(form.get("reviewed_run_id"));
    await withAdminAction(roles, (tx, actor) => clearAnalystViewReview(tx, actor, id, run));
    refresh(); return { ok: true, id };
  } catch { return errorResult(); }
}
export async function regenerateResearchDraft(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const id = uuid.parse(form.get("draft_id"));
    const [previous] = await dbApp.select({ security_id: researchDraft.security_id }).from(researchDraft).where(eq(researchDraft.id, id));
    if (!previous) return errorResult();
    const next = new FormData();
    next.set("security_id", previous.security_id);
    next.set("previous_draft_id", id);
    next.set("guidance", String(form.get("guidance") ?? ""));
    return requestResearchDraft(next);
  } catch { return errorResult(); }
}
export async function saveResearchEdits(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const id = uuid.parse(form.get("draft_id"));
    const parsed = modelDraftSchema.parse(JSON.parse(z.string().max(750_000).parse(form.get("text"))));
    const reasons = z.array(z.enum(EDIT_REASONS)).min(1).parse(form.getAll("edit_reasons"));
    const [row] = await dbApp.select({ security_id: researchDraft.security_id }).from(researchDraft).where(eq(researchDraft.id, id));
    if (!row) return errorResult();
    const settings = await validationSettings(row.security_id, new Date().toISOString());
    await withAdminAction(roles, async (tx, actor) => {
      await assertActiveAnalyst(tx, actor.id);
      const { draft, packet } = await lockedDraft(tx, id, expectedHash(form));
      assertTransition(draft.state, "edited", 0);
      const text = assembleDraft(parsed, packet);
      const issues = validateResearchDraft(text, packet, settings);
      const hash = researchTextHash(text);
      const [saved] = await tx.update(researchDraft).set({ analyst_text: text, text_hash: hash,
        validation_text_hash: hash, validation_results: issues, state: "edited" }).where(eq(researchDraft.id, id)).returning();
      await recordResearch(tx, actor, "research_edited", saved, packet.packet_hash, draft.state, "edited", { edit_reasons: reasons });
    });
    refresh(); return { ok: true, id };
  } catch { return errorResult(); }
}
export async function transitionResearchDraft(form: FormData): Promise<ResearchActionResult> {
  await requireRole(roles);
  try {
    const id = uuid.parse(form.get("draft_id"));
    const to = z.enum(RESEARCH_STATES).parse(form.get("to_state"));
    const [row] = await dbApp.select({ security_id: researchDraft.security_id }).from(researchDraft).where(eq(researchDraft.id, id));
    if (!row) return errorResult();
    const settings = await validationSettings(row.security_id, new Date().toISOString());
    const checklist = to === "approved" ? z.record(z.enum(CHECKLIST), z.boolean()).parse(
      JSON.parse(z.string().parse(form.get("checklist")))) as Checklist : undefined;
    const note = z.string().max(2000).parse(form.get("note") ?? "");
    await withAdminAction(roles, async (tx, actor) => {
      await assertActiveAnalyst(tx, actor.id);
      if (to === "approved") await tx.execute(researchWriteLock);
      const { draft, packet } = await lockedDraft(tx, id, expectedHash(form));
      const issues = validateResearchDraft(draft.analyst_text, packet, settings);
      assertTransition(draft.state, to, blockingCount(issues), checklist);
      // Insert review evidence before UPDATE: the database transition trigger
      // checks this same transaction's checklist/current text hash.
      const updated = { ...draft, state: to, validation_results: issues, validation_text_hash: draft.text_hash };
      await recordResearch(tx, actor, "research_transition", updated, packet.packet_hash, draft.state, to, { checklist, note });
      await tx.update(researchDraft).set({ state: to, validation_results: issues, validation_text_hash: draft.text_hash })
        .where(eq(researchDraft.id, id));
    });
    refresh(); return { ok: true, id };
  } catch { return errorResult(); }
}
export async function saveResearchSettings(form: FormData): Promise<ResearchActionResult> {
  await requireRole(["admin"]);
  try {
    const settings = scopeSettingsSchema.parse({
      monthly_token_budget: Number(form.get("monthly_token_budget")),
      max_active_research_stocks: Number(form.get("max_active_research_stocks")),
      allowed_sectors: JSON.parse(String(form.get("allowed_sectors"))),
      max_packet_age_days: Number(form.get("max_packet_age_days")),
      max_financial_age_days: Number(form.get("max_financial_age_days")),
      price_move_threshold_percent: Number(form.get("price_move_threshold_percent")),
      publication_age_days: Number(form.get("publication_age_days")),
    });
    await withAdminAction(["admin"], (tx, actor) => updateResearchSettings(tx, actor, settings));
    refresh(); return { ok: true };
  } catch { return errorResult(); }
}
export async function changeResearchGate(form: FormData): Promise<ResearchActionResult> {
  await requireRole(["admin"]);
  try {
    const enabled = form.get("enabled") === "on" || form.get("enabled") === "true";
    const decision = z.string().max(100).parse(form.get("decision_id") ?? "");
    const lawyer = z.string().max(1000).parse(form.get("lawyer_reference") ?? "");
    assertGateEvidence(enabled, decision, lawyer);
    await withAdminAction(["admin"], (tx, actor) => updateResearchGate(tx, actor, enabled, decision, lawyer));
    refresh(); return { ok: true };
  } catch { return errorResult(); }
}
export async function reconcileResearchDraft(form: FormData): Promise<ResearchActionResult> {
  await requireRole(["admin"]);
  try {
    const id = uuid.parse(form.get("draft_id"));
    await withAdminAction(["admin"], (tx, actor) => reconcileRequestedDraft(tx, actor, id));
    refresh(); return { ok: true, id };
  } catch { return errorResult(); }
}
