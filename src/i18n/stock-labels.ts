import { displayLabel, presentationLabels, publicUiCopy } from "./presentation";
import { stripPublicReviewMarker } from "../components/foundation/shared";
import type { StockCriterion } from "../stock/types";
import type { ReasonCode, StatusReason } from "../engine/types";
import { renderEnglish } from "../engine/reasons/en";
import { renderArabicDraft } from "../engine/reasons/ar";
import { uiOneDisplay } from "./approved-arabic-ui-one";

type Locale = "ar" | "en";
/** Recognized impact keys use existing approved severity labels; prose is preserved. */
export function stockUnknownEffect(value: string, locale: Locale) {
  return Object.hasOwn(presentationLabels.severity, value)
    ? displayLabel("severity", value, locale)
    : locale === "ar" ? publicUiCopy[value] ?? value : value;
}
// Exact governed definitions only; arbitrary free-text labels retain identity.
const knownCriteria: Record<string, { family: "criterionType" | "lineItem"; value: string }> = {
  "Prohibited primary business activity": { family: "criterionType", value: "business_activity" },
  "Interest-bearing debt / market value basis": { family: "criterionType", value: "interest_bearing_debt" },
  "Prohibited income / total revenue": { family: "lineItem", value: "prohibited_income" },
  "Business activity": { family: "criterionType", value: "business_activity" },
  "Non-permissible revenue": { family: "criterionType", value: "non_permissible_revenue" },
  "Interest-bearing debt": { family: "criterionType", value: "interest_bearing_debt" },
  "Cash and investments": { family: "criterionType", value: "cash_and_investments" },
  "Accounts receivable": { family: "criterionType", value: "receivables" },
};
export function stockCriterionLabel(criterion: Pick<StockCriterion, "criterion_label">, locale: Locale) {
  const raw = criterion.criterion_label ?? "";
  const approved = uiOneDisplay(raw, locale);
  if (approved !== raw) return approved;
  if (locale === "ar" && raw === "Interest-bearing debt / market value basis")
    return `${displayLabel("lineItem", "interest_bearing_debt", locale)} / ${displayLabel("lineItem", "market_value_basis", locale)}`;
  if (locale === "ar" && raw === "Prohibited income / total revenue")
    return `${displayLabel("lineItem", "prohibited_income", locale)} / ${displayLabel("lineItem", "total_revenue", locale)}`;
  const known = knownCriteria[raw];
  return locale === "ar" && known ? displayLabel(known.family, known.value, locale)
    : locale === "ar" && publicUiCopy[raw] ? publicUiCopy[raw] : stripPublicReviewMarker(raw);
}
export function stockReasonField(field: string, locale: Locale) {
  const approved = uiOneDisplay(field, locale);
  if (approved !== field) return approved;
  if (locale !== "ar") return field;
  if (field === "Business segments") return displayLabel("lineItem", "business_segments", locale);
  // Composite definitions remain distinct, but each confirmed key is localized.
  const parts = field.split(/(\s*[+/]\s*)/);
  return parts.map(part => {
    const value = part.trim();
    if (value in knownCriteria) return stockCriterionLabel({ criterion_label: value }, locale);
    const line = displayLabel("lineItem", value, locale);
    return line !== displayLabel("lineItem", "__unknown__", locale) ? line
      : publicUiCopy[value] ?? part;
  }).join("");
}

/** Reuse approved explanations exactly; unknown free text is never guessed. */
export function arabicKnownReason(text: string | null): string | null {
  if (!text) return null;
  const codes: ReasonCode[] = ["denominator_unavailable", "denominator_nonpositive", "numerator_unavailable",
    "no_segments", "shares_unavailable", "unclassified_primary", "primary_tied",
    "primary_prohibited", "primary_permissible", "evaluator_unregistered", "stale_data"];
  for (const reasonCode of codes) {
    const reason: StatusReason = { kind: "review_unknown", criterionId: null, label: "", field: "",
      ratio: null, threshold: null, thresholdUnit: null, reasonCode };
    if (renderEnglish(reason).slice(2) === text) return renderArabicDraft(reason).slice(2);
  }
  return publicUiCopy[text] ?? null;
}
