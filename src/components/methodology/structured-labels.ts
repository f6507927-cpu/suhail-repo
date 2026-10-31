import { displayLabel, publicUiCopy, type LabelFamily } from "@/i18n/presentation";

export function enumDisplayLabel(family: Exclude<LabelFamily, "structured">, value: string, locale: "ar" | "en") {
  return displayLabel(family, value, locale);
}

const valueFamilies: Readonly<Record<string, LabelFamily>> = {
  method_type: "methodType",
  methodology_type: "methodType",
  official_or_inspired: "methodSource",
  method_source: "methodSource",
  licensing_status: "licence",
  licence: "licence",
  license: "licence",
  workflow_status: "workflow",
  criterion_type: "criterionType",
  result: "result",
  input_state: "inputState",
  confidence: "confidence",
  confidence_tier: "tier",
  tier: "tier",
  data_adequacy: "adequacy",
  adequacy: "adequacy",
  source_type: "sourceType",
  threshold_unit: "thresholdUnit",
  threshold_direction: "direction",
  direction: "direction",
  unit: "scale",
  unit_scale: "scale",
  line_item: "lineItem",
  line_items: "lineItem",
  numerator_line_items: "lineItem",
  denominator_line_items: "lineItem",
  required_inputs: "lineItem",
  category: "activity",
  activity_category: "activity",
  prohibited_categories: "activity",
  non_permissible_categories: "activity",
};

export function structuredKeyLabel(key: string, locale: "ar" | "en") {
  return displayLabel("structured", key, locale);
}

export function structuredValueLabel(key: string, value: unknown, locale: "ar" | "en") {
  if (typeof value === "boolean") {
    const label = value ? "Yes" : "No";
    return locale === "ar" ? publicUiCopy[label] ?? label : label;
  }
  if (typeof value !== "string") return null;
  const family = valueFamilies[key];
  return family ? displayLabel(family, value, locale) : value;
}

export function lineItemLabel(value: string, locale: "ar" | "en") {
  return enumDisplayLabel("lineItem", value, locale);
}

export function lineItemFamily(key: string): LabelFamily | undefined {
  return valueFamilies[key];
}
