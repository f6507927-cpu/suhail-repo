import type { CriterionResult, ScreeningUnknown, Status, StatusReason } from "../types";

export function buildReasons(status: Status, criteria: CriterionResult[], unknowns: ScreeningUnknown[]): StatusReason[] {
  const criterionReason = (c: CriterionResult, kind: StatusReason["kind"]): StatusReason => ({
    kind, criterionId: c.criterionId, label: c.label, ratio: c.ratio,
    threshold: c.threshold, thresholdUnit: c.thresholdUnit,
    reasonCode: c.resultReasonCode, field: null,
  });
  const unknownReason = (u: ScreeningUnknown, kind: StatusReason["kind"]): StatusReason => ({
    kind, criterionId: u.criterionId, label: u.label, ratio: null,
    threshold: null, thresholdUnit: null, reasonCode: u.reasonCode, field: u.field,
  });
  if (status === "fails_selected_methodology") {
    return [
      ...criteria.filter((c) => c.result === "fail").map((c) => criterionReason(c, "failure")),
      {
        kind: "counts", criterionId: null, label: "", ratio: null, threshold: null,
        thresholdUnit: null, reasonCode: "criterion_counts", field: null,
        borderlineCount: criteria.filter((c) => c.result === "borderline").length,
        unknownCount: criteria.filter((c) => c.result === "unknown").length,
      },
    ];
  }
  if (status === "insufficient_data") {
    return unknowns.filter((u) => u.severity === "blocking").map((u) => unknownReason(u, "blocking_unknown"));
  }
  if (status === "requires_review") {
    return [
      ...criteria.filter((c) => c.result === "borderline" || c.result === "unknown")
        .map((c) => criterionReason(c, c.result === "borderline" ? "borderline" : "criterion_unknown")),
      ...unknowns.filter((u) => u.severity === "review").map((u) => unknownReason(u, "review_unknown")),
    ];
  }
  return [];
}
