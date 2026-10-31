/** Standalone contract: no runtime or type dependency on the database. */
export type InputState = "reported" | "derived" | "estimated" | "unknown";
export type EvidenceState = InputState | "missing";
export type ConfidenceTier = "Verified" | "Calculated" | "Estimated" | "AI Interpretation";
export type CriterionResultCode = "pass" | "borderline" | "fail" | "unknown";
export type Status = "passes_selected_methodology" | "requires_review" | "fails_selected_methodology" | "insufficient_data";
export type ThresholdUnit = "percent_of_total_revenue" | "percent_of_total_assets" | "percent_of_market_cap" | "boolean" | "absolute";
export type ThresholdDirection = "max" | "min" | "boolean";
export type JsonValue = null | boolean | string | number | (JsonValue | undefined)[] | { [key: string]: JsonValue | undefined };
export type JsonObject = { [key: string]: JsonValue | undefined };

export interface Fact {
  lineItem: string;
  value: number | null;
  inputState: InputState;
  confidenceTier: ConfidenceTier;
  sourceId: string;
}
export interface Segment {
  segmentName: string;
  activityCategory: string;
  revenueAmount: number | null;
  revenueShare: number | null;
  inputState: InputState;
  /** D-81 requires evidence tiers; D-89 also includes them in the hash. */
  confidenceTier: ConfidenceTier;
  sourceId: string;
}
export interface Criterion {
  id: string;
  /** Open string to support §7.2's unregistered-evaluator blocking unknown. */
  criterionType: string;
  label: string;
  definition: string;
  formulaText: string;
  numeratorDefinition: string;
  denominatorDefinition: string;
  numeratorLineItems: string[];
  denominatorLineItems: string[];
  threshold: number | null;
  thresholdUnit: ThresholdUnit;
  thresholdDirection: ThresholdDirection;
  borderlineMargin: number | null;
  treatmentRules: string;
  treatmentRuleData: JsonObject;
  edgeCases: string;
  /** D-87: metadata, never an extra source of used evidence. */
  requiredInputs: string[];
  sourceReference: string;
  effectiveDate: string;
  sortOrder: number;
  notes: string;
}
export interface EngineInput {
  securityId: string;
  asOf: string;
  stalenessLimitDays?: number;
  engineVersion: string;
  calculationVersion: string;
  methodologyVersion: { id: string; label: string; criteria: Criterion[] };
  period: { id: string; label: string; periodEnd: string };
  facts: Fact[];
  segments: Segment[];
}
export type ReasonCode =
  | "boolean_positive" | "boolean_nonpositive" | "within_margin"
  | "max_within_limit" | "max_exceeded" | "min_met" | "min_not_met"
  | "denominator_unavailable" | "denominator_nonpositive" | "numerator_unavailable"
  | "no_segments" | "shares_unavailable" | "unclassified_primary" | "primary_tied"
  | "primary_prohibited" | "primary_permissible" | "evaluator_unregistered"
  | "stale_data" | "criterion_counts";
export interface ScreeningUnknown {
  criterionId: string | null;
  label: string;
  field: string;
  explanation: string;
  severity: "blocking" | "review";
  reasonCode: ReasonCode;
}
export interface CriterionResult {
  criterionId: string;
  criterionType: string;
  label: string;
  result: CriterionResultCode;
  numeratorValue: number | null;
  denominatorValue: number | null;
  numeratorDefinition: string;
  denominatorDefinition: string;
  ratio: number | null;
  threshold: number | null;
  thresholdUnit: ThresholdUnit;
  thresholdDirection: ThresholdDirection;
  borderlineMargin: number | null;
  inputStates: EvidenceState[];
  confidenceTier: ConfidenceTier | null;
  sourceIds: string[];
  calculationTrace: string;
  resultReasonCode: ReasonCode;
  sortOrder: number;
  sourceReference: string;
}
/** D-42/D-59: locale-independent objects, not stored English/Arabic prose. */
export interface StatusReason {
  kind: "failure" | "borderline" | "criterion_unknown" | "blocking_unknown" | "review_unknown" | "counts";
  criterionId: string | null;
  label: string;
  ratio: number | null;
  threshold: number | null;
  thresholdUnit: ThresholdUnit | null;
  reasonCode: ReasonCode;
  field: string | null;
  borderlineCount?: number;
  unknownCount?: number;
}
export interface EngineResult {
  status: Status;
  dataAdequacy: "adequate" | "adequate_with_estimates" | "inadequate";
  confidence: "High" | "Medium" | "Low";
  criteria: CriterionResult[];
  unknowns: ScreeningUnknown[];
  statusReasons: StatusReason[];
  immutableHash: string;
  financialSnapshotId: string;
  /** D-43: this exact canonical projection must be stored and reverified. */
  hashPayload: JsonObject;
}
