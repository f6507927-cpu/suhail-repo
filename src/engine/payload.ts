import { canonicalize, compareCodePoints } from "./canonical";
import type { EngineInput, EngineResult, JsonObject } from "./types";

/** D-43/D-89: evidence-complete extension of §7.4, not live data verification. */
export function projectPayload(input: EngineInput, output: Omit<EngineResult, "hashPayload" | "immutableHash" | "financialSnapshotId">): JsonObject {
  return canonicalize({
    engine_version: input.engineVersion,
    calculation_version: input.calculationVersion,
    security_id: input.securityId,
    methodology_version_id: input.methodologyVersion.id,
    methodology_version_label: input.methodologyVersion.label,
    financial_period_id: input.period.id,
    financial_period_label: input.period.label,
    financial_period_end: input.period.periodEnd,
    as_of: input.asOf,
    staleness_limit_days: input.stalenessLimitDays ?? 550,
    facts: [...input.facts].sort((a, b) => compareCodePoints(a.lineItem, b.lineItem)).map((f) => ({
      line_item: f.lineItem, value: f.value, input_state: f.inputState,
      confidence_tier: f.confidenceTier, source_id: f.sourceId,
    })),
    segments: [...input.segments].sort((a, b) => compareCodePoints(a.segmentName, b.segmentName)).map((s) => ({
      segment_name: s.segmentName, activity_category: s.activityCategory,
      revenue_amount: s.revenueAmount, revenue_share: s.revenueShare,
      input_state: s.inputState, confidence_tier: s.confidenceTier, source_id: s.sourceId,
    })),
    criteria: input.methodologyVersion.criteria.map((c) => ({
      id: c.id, criterion_type: c.criterionType, threshold: c.threshold,
      threshold_unit: c.thresholdUnit, threshold_direction: c.thresholdDirection,
      borderline_margin: c.borderlineMargin, numerator_line_items: c.numeratorLineItems,
      denominator_line_items: c.denominatorLineItems, treatment_rule_data: c.treatmentRuleData,
      label: c.label, numerator_definition: c.numeratorDefinition,
      denominator_definition: c.denominatorDefinition, source_reference: c.sourceReference, sort_order: c.sortOrder,
    })),
    outputs: {
      status: output.status, data_adequacy: output.dataAdequacy, confidence: output.confidence,
      criteria: output.criteria.map((c) => ({
        result: c.result, numerator: c.numeratorValue, denominator: c.denominatorValue, ratio: c.ratio,
        criterion_id: c.criterionId, criterion_type: c.criterionType, label: c.label,
        numerator_definition: c.numeratorDefinition, denominator_definition: c.denominatorDefinition,
        threshold: c.threshold, threshold_unit: c.thresholdUnit, threshold_direction: c.thresholdDirection,
        borderline_margin: c.borderlineMargin, input_states: c.inputStates,
        confidence_tier: c.confidenceTier, source_ids: c.sourceIds,
        calculation_trace: c.calculationTrace, result_reason_code: c.resultReasonCode,
        source_reference: c.sourceReference, sort_order: c.sortOrder,
      })),
      unknowns: output.unknowns.map((u) => ({
        criterion_id: u.criterionId, label: u.label, field: u.field,
        explanation: u.explanation, severity: u.severity, reason_code: u.reasonCode,
      })),
      status_reasons: output.statusReasons.map((r) => ({
        kind: r.kind, criterion_id: r.criterionId, label: r.label, ratio: r.ratio,
        threshold: r.threshold, threshold_unit: r.thresholdUnit, reason_code: r.reasonCode,
        field: r.field, borderline_count: r.borderlineCount, unknown_count: r.unknownCount,
      })),
    },
  }) as JsonObject;
}
