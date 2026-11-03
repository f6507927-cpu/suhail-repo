import base from "../../../data/methodologies/al-rajhi-adapted-1.0.json";
import draft from "../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import type { Criterion, JsonObject } from "../../engine/types";

/** D-154: in-memory draft definition only. No services/DB, approval or activation. */
export function proposedV11Definition() {
  const definition = structuredClone(base);
  definition.version = { ...definition.version, version: draft.version, version_label: draft.version_label,
    changelog: "D-154: add a Suhail assumption-based upper-bound fallback; normal governance required.",
    notes: `${draft.upper_bound.explanation} Draft only; unpublished, no approval or production enablement.`, is_public: false };
  const income = definition.criteria.find(criterion => criterion.key === "income")!;
  Object.assign(income, {
    definition: `${income.definition} ${draft.upper_bound.explanation}`,
    formula_text: "Prefer existing income evidence. Otherwise (cash + short-term securities + long-term securities) × annual_yield_assumption / total_revenue × 100 ≤ threshold.",
    treatment_rule_data: { suhail_upper_bound: draft.upper_bound },
    treatment_rules: `${income.treatment_rules} D-154: cash is required; securities absent from the filing's Assets section (PRE/CAL) count as zero, labelled not on balance sheet. Only potentially cash, deposit, investment or securities asset lines with custom/unreadable evidence block completeness; unrelated custom assets and liabilities do not. An excessive bound is unknown, not fail. Protected analyst decisions win.`,
    source_reference: `${income.source_reference}; D-154 Suhail assumption, not part of the Al Rajhi document`,
    notes: draft.upper_bound.explanation,
  });
  return definition;
}
export function proposedV11IncomeCriterion(): Criterion {
  const c = proposedV11Definition().criteria.find(criterion => criterion.key === "income")!;
  return { id: "draft-v1.1-income", criterionType: c.criterion_type, label: c.label,
    definition: c.definition, formulaText: c.formula_text, numeratorDefinition: c.numerator_definition,
    denominatorDefinition: c.denominator_definition!, numeratorLineItems: c.numerator_line_items,
    denominatorLineItems: c.denominator_line_items, threshold: c.threshold, thresholdUnit: "percent_of_total_revenue",
    thresholdDirection: "max", borderlineMargin: null,
    treatmentRules: c.treatment_rules, treatmentRuleData: c.treatment_rule_data as unknown as JsonObject,
    edgeCases: c.edge_cases, requiredInputs: [], sourceReference: c.source_reference,
    effectiveDate: c.effective_date, sortOrder: c.sort_order, notes: c.notes };
}
