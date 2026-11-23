import "server-only";
import { eq, sql } from "drizzle-orm";
import { researchSetting } from "../../db/schema/research";
import type { Tx, AppUser } from "../auth/audit";
import { recordResearch } from "./store";
import { assertGateEvidence, type ScopeSettings } from "./workflow";

type Settings = typeof researchSetting.$inferSelect;
function scopeSnapshot(row: Settings) {
  return { monthly_token_budget: row.monthly_token_budget, max_active_research_stocks: row.max_active_research_stocks,
    allowed_sectors: row.allowed_sectors, max_packet_age_days: row.max_packet_age_days,
    max_financial_age_days: row.max_financial_age_days, price_move_threshold_percent: row.price_move_threshold_percent,
    publication_age_days: row.publication_age_days };
}
function gateSnapshot(row: Settings) {
  return { enabled: row.ai_research_publishing, decision_id: row.gate_decision_id,
    lawyer_reference: row.gate_lawyer_answer_ref, enabled_by: row.gate_enabled_by,
    enabled_at: row.gate_enabled_at?.toISOString() ?? null };
}
export async function updateResearchSettings(tx: Tx, actor: AppUser, settings: ScopeSettings) {
  await tx.execute(sql`select pg_advisory_xact_lock(73501948)`);
  const [before] = await tx.select().from(researchSetting).where(eq(researchSetting.id, 1)).for("update");
  if (!before) throw new Error("Research settings unavailable");
  const [after] = await tx.update(researchSetting).set({ ...settings,
    price_move_threshold_percent: String(settings.price_move_threshold_percent) }).where(eq(researchSetting.id, 1)).returning();
  await recordResearch(tx, actor, "research_settings", null, null, null, null,
    { details: { before: scopeSnapshot(before), after: scopeSnapshot(after) } });
}
export async function updateResearchGate(tx: Tx, actor: AppUser, enabled: boolean, decision: string, lawyer: string) {
  assertGateEvidence(enabled, decision, lawyer);
  const [before] = await tx.select().from(researchSetting).where(eq(researchSetting.id, 1)).for("update");
  if (!before) throw new Error("Research settings unavailable");
  const [after] = await tx.update(researchSetting).set({
    ai_research_publishing: enabled, gate_decision_id: enabled ? decision : null,
    gate_lawyer_answer_ref: enabled ? lawyer : null, gate_enabled_by: enabled ? actor.id : null,
    gate_enabled_at: enabled ? new Date() : null,
  }).where(eq(researchSetting.id, 1)).returning();
  await recordResearch(tx, actor, "research_gate", null, null, null, null,
    { details: { before: gateSnapshot(before), after: gateSnapshot(after) } });
}
