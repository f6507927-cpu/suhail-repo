import "server-only";
import { inArray } from "drizzle-orm";
import { financialFact, source } from "../../db/schema/market";
import type { Tx } from "../auth/audit";
import type { Fact } from "../../engine/types";
import { BOUND_CONTEXT, boundContextSchema, boundKeys, BOUND_VERSION } from "../../ingest/sec/fsn/stored-bound";
import draft from "../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import { CASH_SHORT_SUBTOTAL } from "../../ingest/sec/fsn/bound-tag-policy";

type Row = typeof financialFact.$inferSelect;
type Source = typeof source.$inferSelect;
export const isBound = (key: string) => key.startsWith("suhail_bound_");

/** D-155: eligibility is rechecked against CURRENT stored decisions, not frozen at refresh.
 * No network or clock; ordinary v1.0 facts remain untouched.
 */
/** Same-filing balance-sheet context check shared by the income upper bound
 * (D-155) and the asset ratios (D-171/D-172). The protected-income check only
 * applies to the income bound: it never invalidates asset evidence.
 */
function boundContextValid(rows: Row[], sources: Source[], requireUnprotectedIncome: boolean) {
  const find = (key: string) => rows.find(f => f.line_item === key);
  const ctx = find(BOUND_CONTEXT), revenue = find("total_revenue"), income = find("prohibited_income");
  const parts = Object.entries(boundKeys).map(([name, key]) => ({ name, row: find(key) }));
  let valid = false;
  if (ctx?.value_text) {
    const parsed = boundContextSchema.safeParse((() => {
      try { return JSON.parse(ctx.value_text); } catch { return null; }
    })());
    const document = sources.find(s => s.id === ctx.source_id);
    const revenueSource = sources.find(s => s.id === revenue?.source_id);
    const genuine = (s: Source | undefined) => s && s.confidence_tier === "Verified" &&
      !s.is_demo && !s.is_synthetic && !s.production_blocked && s.source_type === "regulatory_filing";
    if (parsed.success) {
      const c = parsed.data;
      valid = ctx.value === 1 && ctx.origin === "sec_fsn" && !ctx.protected_current &&
        ctx.calculation_version === BOUND_VERSION && !(requireUnprotectedIncome && income?.protected_current) &&
        !!revenue && revenue.value !== null && revenue.input_state !== "missing" &&
        revenue.input_state !== "unknown" && revenue.value === c.revenue &&
        ctx.period_id === revenue.period_id && ctx.as_of_date === c.fiscalEnd &&
        revenue.as_of_date === c.fiscalEnd && !!genuine(document) && !!genuine(revenueSource) &&
        document!.document_reference === c.accession && revenueSource!.document_reference === c.accession &&
        document!.source_url === c.filingLink && revenueSource!.source_url === c.filingLink &&
        parts.every(({ name, row }) => {
          const expected = c.components[name as keyof typeof boundKeys];
          return row && row.origin === "sec_fsn" && !row.protected_current &&
            row.calculation_version === BOUND_VERSION && row.period_id === ctx.period_id &&
            row.source_id === ctx.source_id && row.as_of_date === c.fiscalEnd &&
            row.value !== null && row.value === expected.value && row.input_state !== "missing" &&
            row.input_state !== "unknown" && (expected.state === "reported" ||
              (name !== "cash" && expected.state === "not_on_balance_sheet" && expected.value === 0) ||
              (name === "short_term" && expected.state === "included_in_subtotal" && expected.value === 0 &&
                expected.tags.length === 1 && expected.tags[0] === CASH_SHORT_SUBTOTAL &&
                c.components.cash.state === "reported" && c.components.cash.tags.length === 1 &&
                c.components.cash.tags[0] === CASH_SHORT_SUBTOTAL));
        });
    }
  }
  return { valid, parts, ctx };
}
export function boundScreeningFacts(rows: Row[], sources: Source[]): Fact[] {
  const { valid, parts, ctx } = boundContextValid(rows, sources, true);
  return [
    ...parts.flatMap(({ row }): Fact[] => row ? [{
      lineItem: row.line_item, value: row.value, inputState: row.input_state === "missing" ? "unknown" : row.input_state,
      confidenceTier: row.confidence_tier, sourceId: row.source_id ?? "",
    }] : []),
    { lineItem: draft.upper_bound.eligibility_line_item, value: valid ? 1 : 0,
      inputState: "derived", confidenceTier: "Calculated", sourceId: ctx?.source_id ?? "" },
  ];
}
/** Engine-only keys for balance-sheet ratios; never stored as financial facts. */
export const assetKeys = {
  cash: "suhail_assets_cash",
  short_term: "suhail_assets_short_term_securities",
  long_term: "suhail_assets_long_term_securities",
} as const;
export const isAssetKey = (key: string) => (Object.values(assetKeys) as string[]).includes(key);
/** D-171/D-172: cash and short/long-term securities from the same validated
 * filing context as the D-155 bound; unknown (never zero) unless that context
 * is valid. A protected income decision does not affect asset evidence.
 */
export function assetScreeningFacts(rows: Row[], sources: Source[]): Fact[] {
  const { valid, parts } = boundContextValid(rows, sources, false);
  return parts.map(({ name, row }): Fact => ({
    lineItem: assetKeys[name as keyof typeof assetKeys],
    value: valid ? row!.value : null,
    inputState: valid ? (row!.input_state === "missing" ? "unknown" : row!.input_state) : "unknown",
    confidenceTier: valid ? row!.confidence_tier : "Estimated",
    sourceId: row?.source_id ?? "",
  }));
}
export function usesAssetKeys(criteria: { numerator_line_items?: string[]; denominator_line_items?: string[];
  numeratorLineItems?: string[]; denominatorLineItems?: string[] }[]) {
  return criteria.some(c => [...(c.numerator_line_items ?? c.numeratorLineItems ?? []),
    ...(c.denominator_line_items ?? c.denominatorLineItems ?? [])].some(isAssetKey));
}
export async function storedAssetInputs(tx: Tx, rows: Row[], enabled: boolean): Promise<Fact[]> {
  if (!enabled) return [];
  const ids = [...new Set(rows.map(f => f.source_id).filter((id): id is string => !!id))];
  return assetScreeningFacts(rows, ids.length ? await tx.select().from(source).where(inArray(source.id, ids)) : []);
}
export async function storedBoundInputs(tx: Tx, rows: Row[], enabled: boolean): Promise<Fact[]> {
  if (!enabled) return [];
  const ids = [...new Set(rows.map(f => f.source_id).filter((id): id is string => !!id))];
  return boundScreeningFacts(rows, ids.length ? await tx.select().from(source).where(inArray(source.id, ids)) : []);
}
