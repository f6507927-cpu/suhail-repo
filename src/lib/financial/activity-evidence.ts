import { and, desc, eq, lt } from "drizzle-orm";
import { businessSegment, financialPeriod } from "../../db/schema/market";
import type { Tx } from "../auth/audit";
import { financialFact } from "../../db/schema/market";
import { sicActivity } from "./sic-activity";

type Segment = typeof businessSegment.$inferSelect;
type Period = typeof financialPeriod.$inferSelect;

/** D-157: classifications are analyst-authored evidence, not SEC sector labels. */
export function selectActivityEvidence(
  current: Segment[], previous: Segment[], sourcePeriod: Period | undefined, asOf: string,
): Segment[] {
  // An explicit current-period decision, including an unclassified override,
  // must never be replaced by older evidence.
  if (current.length) return current;
  if (!sourcePeriod?.period_end) return [];
  const now = new Date(`${asOf}T00:00:00Z`);
  const cutoff = new Date(now);
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 18);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  const end = new Date(`${sourcePeriod.period_end}T00:00:00Z`);
  if (!Number.isFinite(+now) || !Number.isFinite(+end) || end > now || end < cutoff) return [];
  // No partial carry-forward: unclassified/unsourced rows could change which
  // segment is primary. The audited analyst entry is the existing approval path.
  if (!previous.length || previous.some(s => !s.created_by || !s.source_id ||
    !s.category_basis?.trim() || s.activity_category === "unclassified" ||
    ["unknown", "missing"].includes(s.input_state))) return [];
  return previous.map(s => ({
    ...s,
    segment_name: `${s.segment_name} (from ${sourcePeriod.fiscal_period_label} filing)`,
    // Historical shares identify the historical primary activity only. Do not
    // copy these amounts into current-period financial disclosure.
    revenue_amount: null, input_state: "estimated", confidence_tier: "Estimated",
  }));
}

export async function activityEvidence(tx: Tx, companyId: string, period: Period, asOf: string): Promise<Segment[]> {
  const current = await tx.select().from(businessSegment).where(and(
    eq(businessSegment.company_id, companyId), eq(businessSegment.period_id, period.id)));
  if (current.length || !period.period_end) return current;
  const [previousPeriod] = await tx.select().from(financialPeriod).where(and(
    eq(financialPeriod.company_id, companyId), eq(financialPeriod.period_type, "annual"),
    lt(financialPeriod.period_end, period.period_end)))
    .orderBy(desc(financialPeriod.period_end), desc(financialPeriod.reported_date), desc(financialPeriod.id)).limit(1);
  const previous = previousPeriod ? await tx.select().from(businessSegment).where(and(
    eq(businessSegment.company_id, companyId), eq(businessSegment.period_id, previousPeriod.id))) : [];
  const carried = selectActivityEvidence(current, previous, previousPeriod, asOf);
  if (carried.length) return carried;
  const [sic] = await tx.select().from(financialFact).where(and(
    eq(financialFact.company_id, companyId), eq(financialFact.period_id, period.id),
    eq(financialFact.line_item, "sec_sic_code"), eq(financialFact.is_current, true)));
  const mapped = sic?.value !== null && sic?.value !== undefined && sic.source_id &&
    !["missing", "unknown"].includes(sic.input_state) ? sicActivity(sic.value, sic.source_id) : null;
  if (!mapped) return [];
  return [{
    // Selection-only projection, never inserted as current-year disclosure.
    id: sic.id, company_id: companyId, period_id: period.id, created_by: null,
    created_at: sic.created_at, updated_at: sic.updated_at, is_demo: sic.is_demo,
    segment_name: mapped.segmentName, description: null, category_basis: mapped.segmentName,
    activity_category: mapped.activityCategory as Segment["activity_category"],
    revenue_amount: null, revenue_share: 1, input_state: "estimated", confidence_tier: "Estimated",
    source_id: sic.source_id,
  }];
}
