import { z } from "zod";
import { CHECKLIST, type Checklist, type ResearchState } from "./contracts";

// D-184/D-196: publication edges are documented, but unavailable throughout P2.
export const TRANSITIONS: Readonly<Record<ResearchState, readonly ResearchState[]>> = {
  requested: ["generated", "failed"], generated: ["in_review"],
  in_review: ["changes_requested", "edited", "approved", "rejected"],
  changes_requested: ["edited"], edited: ["in_review"],
  approved: ["published"], published: ["updated", "withdrawn"],
  updated: [], withdrawn: [], rejected: [], failed: [],
};
export function assertTransition(from: ResearchState, to: ResearchState, blocks: number, checklist?: Checklist) {
  if (["published", "updated", "withdrawn"].includes(to)) throw new Error("Publishing is unavailable in P2");
  if (!TRANSITIONS[from].includes(to)) throw new Error("Research transition refused");
  if (to === "approved" && (blocks > 0 || !checklist || CHECKLIST.some(key => checklist[key] !== true)))
    throw new Error("Resolve blocking checks and complete all six checklist answers");
}
export const scopeSettingsSchema = z.strictObject({
  monthly_token_budget: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  max_active_research_stocks: z.number().int().nonnegative(),
  allowed_sectors: z.array(z.strictObject({ sector: z.string().trim().min(1), limit: z.number().int().positive().nullable() })),
  max_packet_age_days: z.number().int().positive(),
  max_financial_age_days: z.number().int().positive(),
  price_move_threshold_percent: z.number().positive(),
  publication_age_days: z.number().int().positive(),
});
export type ScopeSettings = z.infer<typeof scopeSettingsSchema>;
export function assertScope(settings: ScopeSettings, stock: { covered: boolean; in_universe: boolean; sector: string | null },
  active: { security_id: string; sector: string | null }[], securityId: string) {
  scopeSettingsSchema.parse(settings);
  if (!stock.covered || !stock.in_universe) throw new Error("Research requires a covered stock in the universe");
  const allowed = settings.allowed_sectors.find(entry => entry.sector === stock.sector);
  if (!allowed) throw new Error("This sector is not allowed for research");
  const unique = [...new Map(active.map(row => [row.security_id, row])).values()];
  if (unique.some(row => row.security_id === securityId)) return;
  if (unique.length >= settings.max_active_research_stocks) throw new Error("Active research stock limit reached");
  if (allowed.limit !== null && unique.filter(row => row.sector === stock.sector).length >= allowed.limit)
    throw new Error("Research sector limit reached");
}
export function assertGateEvidence(enabled: boolean, decision: string, lawyerReference: string) {
  if (enabled && (!/^D-[0-9]+$/.test(decision) || !lawyerReference.trim()))
    throw new Error("Enabling the gate requires a founder decision ID and lawyer reference");
}
