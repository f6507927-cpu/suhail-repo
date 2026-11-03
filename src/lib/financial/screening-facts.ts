import "server-only";
import { inArray } from "drizzle-orm";
import { financialFact, source } from "../../db/schema/market";
import type { Tx } from "../auth/audit";
import type { Fact } from "../../engine/types";
import { BOUND_CONTEXT, boundContextSchema, boundKeys, BOUND_VERSION } from "../../ingest/sec/fsn/stored-bound";
import draft from "../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";

type Row = typeof financialFact.$inferSelect;
type Source = typeof source.$inferSelect;
export const isBound = (key: string) => key.startsWith("suhail_bound_");

/** D-155: eligibility is rechecked against CURRENT stored decisions, not frozen at refresh.
 * No network or clock; ordinary v1.0 facts remain untouched.
 */
export function boundScreeningFacts(rows: Row[], sources: Source[]): Fact[] {
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
        ctx.calculation_version === BOUND_VERSION && !income?.protected_current &&
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
              (name !== "cash" && expected.state === "not_on_balance_sheet" && expected.value === 0));
        });
    }
  }
  return [
    ...parts.flatMap(({ row }): Fact[] => row ? [{
      lineItem: row.line_item, value: row.value, inputState: row.input_state === "missing" ? "unknown" : row.input_state,
      confidenceTier: row.confidence_tier, sourceId: row.source_id ?? "",
    }] : []),
    { lineItem: draft.upper_bound.eligibility_line_item, value: valid ? 1 : 0,
      inputState: "derived", confidenceTier: "Calculated", sourceId: ctx?.source_id ?? "" },
  ];
}
export async function storedBoundInputs(tx: Tx, rows: Row[], enabled: boolean): Promise<Fact[]> {
  if (!enabled) return [];
  const ids = [...new Set(rows.map(f => f.source_id).filter((id): id is string => !!id))];
  return boundScreeningFacts(rows, ids.length ? await tx.select().from(source).where(inArray(source.id, ids)) : []);
}
