import { unitSuffix } from "../math";
import type { ReasonCode, StatusReason } from "../types";

const explanations: Record<ReasonCode, string> = {
  boolean_positive: "The value is greater than zero.",
  boolean_nonpositive: "The value is zero or negative.",
  within_margin: "The ratio is within the configured borderline margin.",
  max_within_limit: "The ratio is at or below the limit.",
  max_exceeded: "The ratio exceeds the limit.",
  min_met: "The ratio meets the minimum.",
  min_not_met: "The ratio is below the minimum.",
  denominator_unavailable: "cannot be evaluated; screen is Insufficient Data; no value assumed",
  denominator_nonpositive: "denominator is zero or negative; ratio undefined; no value assumed",
  numerator_unavailable: "numerator unavailable; no value assumed",
  no_segments: "no segment disclosure recorded",
  shares_unavailable: "segment revenue share unavailable; primary activity not assumed",
  unclassified_primary: "primary activity is unclassified",
  primary_tied: "primary activity tied between segments",
  primary_prohibited: "The primary activity is in the prohibited categories.",
  primary_permissible: "The primary activity is not in the prohibited categories.",
  evaluator_unregistered: "no evaluator is registered",
  stale_data: "The financial period is older than the configured staleness limit.",
  criterion_counts: "",
};
/** §7.3 failure/blocking templates; review templates retain the same evidence. */
export function renderEnglish(reason: StatusReason): string {
  const explanation = explanations[reason.reasonCode];
  const suffix = reason.thresholdUnit === null ? "" : unitSuffix(reason.thresholdUnit);
  const ratio = reason.ratio === null ? "unknown" : `${reason.ratio.toFixed(2)}${suffix}`;
  const threshold = reason.threshold === null ? "not set" : `${reason.threshold}${suffix}`;
  switch (reason.kind) {
    case "failure": return `${reason.label} criterion: Fail — ${ratio} against a ${threshold} limit. ${explanation}`;
    case "borderline": return `${reason.label} criterion: Borderline — ${ratio} against a ${threshold} limit. ${explanation}`;
    case "criterion_unknown": return `${reason.label} criterion: Unknown — ${explanation}`;
    case "blocking_unknown":
    case "review_unknown": return `${reason.field}: ${explanation}`;
    case "counts": return `${reason.borderlineCount} borderline criteria; ${reason.unknownCount} unknown criteria.`;
  }
}
