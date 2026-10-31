import { unitSuffix } from "../math";
import type { ReasonCode, StatusReason } from "../types";

// D-101: founder-approved deterministic substitutions, never inferred explanations.
const explanations: Record<ReasonCode, string> = {
  boolean_positive: "القيمة أكبر من صفر.",
  boolean_nonpositive: "القيمة صفر أو سالبة.",
  within_margin: "تقع النسبة ضمن هامش الحد المحدد.",
  max_within_limit: "النسبة عند الحد أو دونه.",
  max_exceeded: "تتجاوز النسبة الحد.",
  min_met: "تبلغ النسبة الحد الأدنى أو تتجاوزه.",
  min_not_met: "النسبة دون الحد الأدنى.",
  denominator_unavailable: "لا يمكن تقييمه؛ حالة الفحص هي «بيانات غير كافية»؛ لم تُفترض أي قيمة.",
  denominator_nonpositive: "المقام صفر أو سالب؛ النسبة غير معرّفة؛ لم تُفترض أي قيمة.",
  numerator_unavailable: "البسط غير متاح؛ لم تُفترض أي قيمة.",
  no_segments: "لم يُسجَّل إفصاح عن القطاعات.",
  shares_unavailable: "حصة القطاع من الإيرادات غير متاحة؛ لم يُفترض النشاط الرئيسي.",
  unclassified_primary: "النشاط الرئيسي غير مصنّف.",
  primary_tied: "تساوت أكبر حصص القطاعات، فتعذّر تحديد النشاط الرئيسي.",
  primary_prohibited: "يندرج النشاط الرئيسي ضمن الفئات المحظورة.",
  primary_permissible: "لا يندرج النشاط الرئيسي ضمن الفئات المحظورة.",
  evaluator_unregistered: "لا توجد دالة تقييم مسجلة.",
  stale_data: "الفترة المالية أقدم من الحد المسموح به لعمر البيانات.",
  criterion_counts: "",
};

/** D-101: approved Arabic; keep the exported name for existing callers. */
export function renderArabicDraft(reason: StatusReason): string {
  const explanation = explanations[reason.reasonCode];
  // Match English exactly: ratio to 2 decimals, threshold as configured.
  const suffix = reason.thresholdUnit === null ? "" : unitSuffix(reason.thresholdUnit);
  const ratio = reason.ratio === null ? "غير معروف" : `${reason.ratio.toFixed(2)}${suffix}`;
  const threshold = reason.threshold === null ? "غير محدد" : `${reason.threshold}${suffix}`;
  switch (reason.kind) {
    case "failure": return `معيار ${reason.label}: لم يجتز الفحص — النسبة ${ratio} مقابل حد ${threshold}. ${explanation}`;
    case "borderline": return `معيار ${reason.label}: نتيجة حدية — النسبة ${ratio} مقابل حد ${threshold}. ${explanation}`;
    case "criterion_unknown": return `معيار ${reason.label}: النتيجة غير معروفة — ${explanation}`;
    case "blocking_unknown":
    case "review_unknown": return `${reason.field}: ${explanation}`;
    case "counts": return `عدد المعايير الحدية: ${reason.borderlineCount}؛ عدد المعايير غير المعروفة: ${reason.unknownCount}.`;
  }
}
