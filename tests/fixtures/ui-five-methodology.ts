import { uiOneMethodologyFixture } from "./ui-one-methodology";
import type { PublicMethodologyPageData } from "../../src/db/methodology-public";

/** Local deterministic presentation evidence, never a methodology write. */
export function uiFiveMethodologyFixture(): PublicMethodologyPageData {
  const data = uiOneMethodologyFixture();
  data.methodology.production_enabled = true;
  const document = data.documents[0]!;
  document.version.production_enabled = true;
  document.version.workflow_status = "approved";
  document.version.changelog = "D-122: Founder-authorized draft preparation only.";
  document.version.purification_treatment = {
    evidence: { market_value_basis: null, narrative: "D-132: A stored structured treatment sentence." },
  };
  const original = document.criteria[0]!;
  const labels = ["Prohibited primary business activity", "Interest-bearing debt / market value basis", "Prohibited income / total revenue"];
  document.criteria = labels.map((label, index): typeof original => ({
    ...structuredClone(original), id: `criterion-${index}`, label,
    criterion_type: index === 0 ? "business_activity" : index === 1 ? "interest_bearing_debt" : "non_permissible_revenue",
    threshold: index === 0 ? null : index === 1 ? 30 : 5,
    threshold_unit: index === 0 ? "boolean" : index === 1 ? "percent_of_market_cap" : "percent_of_total_revenue",
    threshold_direction: index === 0 ? "boolean" : "max",
    explanation_ar: `شرح عربي محفوظ للمعيار ${index}.`,
    explanation_en: `Stored English explanation for criterion ${index}.`,
    definition: `D-132: Stored technical definition ${index}.`,
    formula_text: index === 0 ? null : "interest_bearing_debt / market_value_basis × 100 ≤ 30",
    numerator_definition: "interest_bearing_debt", denominator_definition: "market_value_basis",
    numerator_line_items: ["interest_bearing_debt"], denominator_line_items: ["market_value_basis"],
    required_inputs: ["interest_bearing_debt", "market_value_basis"],
    treatment_rules: `D-122/D-123: Stored treatment paragraph ${index}.`,
    treatment_rule_data: { prohibited_categories: ["conventional_finance", "alcohol"] },
    source_reference: `D-125: Source reference ${index}.`,
    edge_cases: `D-126: Stored edge case ${index}.`,
  }));
  return data;
}
