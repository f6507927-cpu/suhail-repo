import type { InferInsertModel } from "drizzle-orm";
import type { methodologyCriterion } from "../../src/db/schema";

const categoriesA = [
  "conventional_finance",
  "interest_based_lending",
  "insurance_conventional",
  "alcohol",
  "tobacco",
  "gambling",
  "adult_entertainment",
  "pork_related",
];
const categoriesB = [
  ...categoriesA,
  "conventional_media",
  "weapons_conventional",
];
type CriterionFixture = Omit<
  InferInsertModel<typeof methodologyCriterion>,
  "methodology_version_id" | "methodology_id"
>;

// §8 cell text is verbatim. No lease line item is added to either numerator
// (D-44/D-62): treatment differences remain methodology text only.
export function criteriaFixtures(example: "A" | "B"): CriterionFixture[] {
  const a = example === "A";
  const categories = a ? categoriesA : categoriesB;
  return [
    {
      criterion_type: "business_activity",
      label: "Business activity",
      threshold: null,
      threshold_unit: "boolean",
      threshold_direction: "boolean",
      borderline_margin: null,
      numerator_line_items: ["business_segments"],
      denominator_line_items: [],
      required_inputs: ["business_segments"],
      sort_order: 1,
      treatment_rule_data: { prohibited_categories: categories },
      treatment_rules: a
        ? "Prohibited: conventional_finance, interest_based_lending, insurance_conventional, alcohol, tobacco, gambling, adult_entertainment, pork_related"
        : "Same list + conventional_media, weapons_conventional",
      definition: "boolean, primary reported segment",
    },
    {
      criterion_type: "non_permissible_revenue",
      label: "Non-permissible revenue ÷ total revenue",
      threshold: a ? 5 : 3,
      threshold_unit: "percent_of_total_revenue",
      threshold_direction: "max",
      borderline_margin: a ? 0.5 : null,
      numerator_line_items: ["business_segments"],
      denominator_line_items: ["total_revenue"],
      required_inputs: ["business_segments", "total_revenue"],
      sort_order: 2,
      treatment_rule_data: { non_permissible_categories: categories },
      treatment_rules: a
        ? "5%, borderline ±0.5 pp"
        : "3%, no margin; same wider category list as B's business test",
    },
    {
      criterion_type: "interest_bearing_debt",
      label: "Interest-bearing debt ÷ total assets",
      threshold: a ? 33 : 25,
      threshold_unit: "percent_of_total_assets",
      threshold_direction: "max",
      borderline_margin: a ? 3 : 2,
      numerator_line_items: ["interest_bearing_debt"],
      denominator_line_items: ["total_assets"],
      required_inputs: ["interest_bearing_debt", "total_assets"],
      sort_order: 3,
      treatment_rule_data: {},
      treatment_rules: a
        ? "33%, borderline ±3 pp; trade payables and non-finance-cost liabilities excluded"
        : "25%, borderline ±2 pp; lease liabilities with a finance cost included",
    },
    {
      criterion_type: "cash_and_investments",
      label: "Cash ÷ total assets",
      threshold: a ? 33 : 25,
      threshold_unit: "percent_of_total_assets",
      threshold_direction: "max",
      borderline_margin: a ? 3 : 2,
      numerator_line_items: a
        ? ["cash_and_equivalents", "interest_bearing_investments"]
        : ["cash_and_equivalents"],
      denominator_line_items: ["total_assets"],
      required_inputs: a
        ? [
            "cash_and_equivalents",
            "interest_bearing_investments",
            "total_assets",
          ]
        : ["cash_and_equivalents", "total_assets"],
      sort_order: 4,
      treatment_rule_data: {},
      treatment_rules: a
        ? "(cash & equivalents + interest-bearing short-term investments) ÷ total assets, 33%, ±3 pp"
        : "cash & equivalents only ÷ total assets, 25%, ±2 pp",
    },
    {
      criterion_type: "receivables",
      label: "Accounts receivable ÷ total assets",
      threshold: a ? 45 : 40,
      threshold_unit: "percent_of_total_assets",
      threshold_direction: "max",
      borderline_margin: null,
      numerator_line_items: ["accounts_receivable"],
      denominator_line_items: ["total_assets"],
      required_inputs: ["accounts_receivable", "total_assets"],
      sort_order: 5,
      treatment_rule_data: {},
      treatment_rules: a ? "45%, no margin" : "40%, no margin",
    },
  ].map((criterion) => ({
    ...criterion,
    is_demo: true,
    effective_date: "2026-01-01",
  })) as CriterionFixture[];
}
