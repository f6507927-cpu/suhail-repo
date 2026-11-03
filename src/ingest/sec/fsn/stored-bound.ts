import { z } from "zod";
import draft from "../../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import type { MappedFact } from "../types";
import type { FsnTarget } from "./contracts";
import { FSN_PROVIDER } from "./contracts";
import type { BalanceSheet } from "./balance-sheet";

export const BOUND_VERSION = "sec-fsn-bound-2";
export const BOUND_CONTEXT = "suhail_bound_context";
export const boundKeys = {
  cash: draft.upper_bound.cash_line_item,
  short_term: draft.upper_bound.short_term_line_item,
  long_term: draft.upper_bound.long_term_line_item,
};
const component = z.object({
  value: z.number().finite().nonnegative().nullable(),
  state: z.enum(["reported", "not_on_balance_sheet", "included_in_subtotal", "unknown"]),
  label: z.string(), reason: z.string().nullable(), tags: z.array(z.string()),
}).passthrough();
export const boundContextSchema = z.object({
  version: z.literal(BOUND_VERSION), accession: z.string().min(1),
  filingLink: z.string().url(), fiscalEnd: z.string(), revenue: z.number().finite().nullable(),
  components: z.object({ cash: component, short_term: component, long_term: component }),
});
/** D-155: separate sourced inputs, never a replacement prohibited_income fact.
 * Unknown refreshes are persisted too, superseding old completeness.
 */
export function storedBalanceFacts(target: FsnTarget, sheet: BalanceSheet): MappedFact[] {
  const context = { version: BOUND_VERSION, accession: sheet.accession, filingLink: sheet.filingLink,
    fiscalEnd: sheet.fiscalEnd, revenue: target.mapped.facts.find(f => f.line_item === "total_revenue")?.value ?? null,
    components: sheet.components, excluded: sheet.excluded ?? [] };
  const complete = Object.values(sheet.components).every(c => c.value !== null && c.state !== "unknown");
  const base: MappedFact = {
    adapter: "sec_fsn", line_item: BOUND_CONTEXT, value: complete ? 1 : 0,
    value_text: JSON.stringify(context), currency: null, unit: "USD", unit_scale: "absolute",
    input_state: "derived", confidence_tier: "Calculated", as_of_date: sheet.fiscalEnd,
    mapping_note: `${FSN_PROVIDER}; balance-sheet completeness and filing context`,
    unknown_note: complete ? null : "Incomplete balance-sheet evidence; upper bound unavailable",
    source: { ...target.mapped.period.source, provider: FSN_PROVIDER },
    calculation_version: BOUND_VERSION,
  };
  return [
    ...Object.entries(boundKeys).map(([name, line_item]): MappedFact => {
      const c = sheet.components[name as keyof typeof boundKeys];
      return { ...base, line_item, value: c.value, value_text: JSON.stringify(c), currency: "USD",
        input_state: c.value === null ? "unknown" : c.state === "reported" ? "reported" : "estimated",
        confidence_tier: c.state === "reported" ? "Verified" : "Estimated",
        mapping_note: `${FSN_PROVIDER}; ${c.label}; tags: ${c.tags.join(", ") || "none"}`,
        unknown_note: c.reason };
    }),
    base,
  ];
}
