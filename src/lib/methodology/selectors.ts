import { activityCategory } from "../../db/schema/core";
// Reference §6 + D-44. These are evidence keys, not methodology thresholds.
export const lineItems = [
  "total_revenue", "total_assets", "total_equity", "interest_bearing_debt",
  "cash_and_equivalents", "interest_bearing_investments", "accounts_receivable",
  "net_income", "operating_cash_flow", "market_cap", "ebitda",
  "prior_year_revenue", "prior_year_net_income", "shares_outstanding",
  "finance_lease_liabilities", "operating_lease_liabilities", "business_segments",
  "market_value_basis", "prohibited_income",
  // D-171/D-172: engine-only balance-sheet inputs from the validated D-155
  // filing context; prepared at screening time, never stored as facts.
  "suhail_assets_cash", "suhail_assets_short_term_securities", "suhail_assets_long_term_securities",
] as const;
export const categories = activityCategory.enumValues;
export function requiredInputs(c:{criterion_type:string;numerator_line_items:string[];denominator_line_items:string[];
  treatment_rule_data?:{additional_numerator_line_items?:string[]}|null}) {
  return [...new Set([...c.numerator_line_items,...c.denominator_line_items,
    ...(c.treatment_rule_data?.additional_numerator_line_items ?? []),
    ...(["business_activity","non_permissible_revenue"].includes(c.criterion_type)?["business_segments"]:[])])];
}
