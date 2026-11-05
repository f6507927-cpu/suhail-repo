import type { StatusReason } from "../engine/types";
import { renderArabicDraft } from "../engine/reasons/ar";
import { renderEnglish } from "../engine/reasons/en";
import { uiOneDisplay } from "../i18n/approved-arabic-ui-one";

type Locale = "ar" | "en";

/** D-157: copies only. Engine templates and immutable evidence remain historical. */
export function displayReason(reason: StatusReason, locale: Locale): string {
  const shown = {
    ...reason,
    label: uiOneDisplay(reason.label, locale),
    field: reason.field === null ? null : uiOneDisplay(reason.field, locale),
  };
  const render = locale === "ar" ? renderArabicDraft : renderEnglish;
  const numeratorExplanation = locale === "ar" ? "الرقم غير متاح، ولم نفترض أي قيمة."
    : uiOneDisplay("numerator unavailable; no value assumed", locale);
  if (reason.thresholdUnit === "boolean" && ["failure", "borderline"].includes(reason.kind)) {
    const explanation = reason.reasonCode === "numerator_unavailable" ? numeratorExplanation
      : render({ ...shown, kind: "criterion_unknown" }).split(" — ").slice(1).join(" — ");
    const result = locale === "ar"
      ? reason.kind === "failure" ? "لم يجتز الفحص" : "نتيجة حدية"
      : reason.kind === "failure" ? "Fail" : "Borderline";
    return locale === "ar" ? `معيار ${shown.label}: ${result} — ${explanation}`
      : `${shown.label} criterion: ${result} — ${explanation}`;
  }
  if (reason.reasonCode === "numerator_unavailable") {
    // Select the new explanation by structured code, never by matching old prose.
    // Empty-explanation template preserves kind, numbers, threshold and surrounding text.
    return render({ ...shown, reasonCode: "criterion_counts" }) + numeratorExplanation;
  }
  return render(shown);
}

/** Suppress only meaningful equivalents; counts and source arrays are untouched. */
export function visibleReasons(reasons: StatusReason[]): StatusReason[] {
  const criteria = reasons.filter(r => r.kind === "criterion_unknown");
  const seen = new Set<string>();
  return reasons.filter(reason => {
    if (reason.kind === "counts" && reason.borderlineCount === 0 && reason.unknownCount === 0) return false;
    const distinctInputs = new Set(reasons.filter(r =>
      (r.kind === "blocking_unknown" || r.kind === "review_unknown") &&
      r.criterionId === reason.criterionId && r.reasonCode === reason.reasonCode,
    ).map(r => r.field));
    if (distinctInputs.size === 1 && (reason.kind === "blocking_unknown" || reason.kind === "review_unknown") && criteria.some(c =>
      c.reasonCode === reason.reasonCode && (
        (reason.criterionId !== null && reason.criterionId === c.criterionId) ||
        (reason.field !== null && reason.field === c.label)
      ))) return false;
    const key = JSON.stringify([reason.kind, reason.criterionId, reason.field, reason.label,
      reason.reasonCode, reason.ratio, reason.threshold, reason.thresholdUnit, reason.borderlineCount, reason.unknownCount]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
