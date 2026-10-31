import { amount, combine, distinct, factSum, segmentEvidence, share, weakest, type Evidence } from "./evidence";
import { compareCodePoints } from "./canonical";
import { add, finite, decide, formatNumber, roundRatio, unitSuffix } from "./math";
import type { Criterion, CriterionResult, EngineInput, ReasonCode, ScreeningUnknown } from "./types";
import { ratioTypes } from "./validate";

export interface Evaluation {
  criterion: CriterionResult;
  unknowns: ScreeningUnknown[];
}
type Evaluator = (c: Criterion, input: EngineInput) => Evaluation;

function base(c: Criterion, evidence: Evidence): CriterionResult {
  return {
    criterionId: c.id, criterionType: c.criterionType, label: c.label,
    result: "unknown", numeratorValue: null, denominatorValue: null, ratio: null,
    numeratorDefinition: c.numeratorDefinition, denominatorDefinition: c.denominatorDefinition,
    threshold: c.threshold, thresholdUnit: c.thresholdUnit, thresholdDirection: c.thresholdDirection,
    borderlineMargin: c.borderlineMargin, inputStates: distinct(evidence.states),
    confidenceTier: weakest(evidence.tiers), sourceIds: distinct(evidence.sources),
    calculationTrace: "", resultReasonCode: "numerator_unavailable",
    sortOrder: c.sortOrder, sourceReference: c.sourceReference,
  };
}
function unknown(c: Criterion, field: string, severity: "review" | "blocking", reasonCode: ReasonCode, explanation: string): ScreeningUnknown {
  return { criterionId: c.id, label: c.label, field, severity, reasonCode, explanation };
}
function finishRatio(c: Criterion, numerator: number | null, denominator: number | null, evidence: Evidence, engineVersion: string, numeratorCode: ReasonCode = "numerator_unavailable"): Evaluation {
  const result = base(c, evidence);
  result.numeratorValue = numerator;
  result.denominatorValue = denominator;
  const unknowns: ScreeningUnknown[] = [];
  if (denominator === null) {
    unknowns.push(unknown(c, c.denominatorDefinition, "blocking", "denominator_unavailable",
      "cannot be evaluated; screen is Insufficient Data; no value assumed"));
  } else if (denominator <= 0) {
    // D-79: zero and negative denominators are not meaningful ratios.
    unknowns.push(unknown(c, c.denominatorDefinition, "blocking", "denominator_nonpositive",
      "denominator is zero or negative; ratio undefined; no value assumed"));
  }
  if (numerator === null) {
    unknowns.push(unknown(c, c.numeratorDefinition, "review", numeratorCode,
      numeratorCode === "no_segments" ? "no segment disclosure recorded" : "numerator unavailable; no value assumed"));
  }
  if (unknowns.length > 0) {
    result.resultReasonCode = unknowns[0].reasonCode;
    result.calculationTrace = unknowns.map((u) => `${u.field}: ${u.explanation}`).join("; ");
  } else {
    const raw = finite(numerator! / denominator! * (c.thresholdUnit.startsWith("percent_") ? 100 : 1), "ratio");
    const ratio = roundRatio(raw);
    result.ratio = ratio;
    // D-125: old payloads must replay using their original rounded decisions.
    const decision = decide(engineVersion === "engine-1.0.1" ? ratio : raw, c);
    result.result = decision.result;
    result.resultReasonCode = decision.reasonCode;
    result.calculationTrace = `${c.numeratorDefinition} (${formatNumber(numerator!)}) ÷ ${c.denominatorDefinition} (${formatNumber(denominator!)}) = ${ratio.toFixed(2)}${unitSuffix(c.thresholdUnit)}`;
  }
  return { criterion: result, unknowns };
}
const ratio: Evaluator = (c, input) => {
  // D-44/D-62: use only explicit configured line items, never silently add leases.
  const numerator = factSum(c.numeratorLineItems, input.facts);
  const denominator = factSum(c.denominatorLineItems, input.facts);
  return finishRatio(c, numerator.value, denominator.value, combine(numerator, denominator), input.engineVersion);
};

const businessActivity: Evaluator = (c, input) => {
  const segments = [...input.segments].sort((a, b) => compareCodePoints(a.segmentName, b.segmentName));
  const result = base(c, segmentEvidence(segments));
  function unavailable(code: ReasonCode, explanation: string): Evaluation {
    result.resultReasonCode = code;
    result.calculationTrace = explanation;
    return { criterion: result, unknowns: [unknown(c, "Business segments", "review", code, explanation)] };
  }
  if (segments.length === 0) return unavailable("no_segments", "no segment disclosure recorded"); // D-13
  const amounts = segments.map(amount);
  const total = amounts.some((a) => a === null) ? null : amounts.reduce<number>((sum, a) => add(sum, a!), 0);
  const shares = segments.map((s) => {
    const disclosed = share(s);
    if (disclosed !== null) return disclosed;
    // D-85: derive only with exhaustive available amounts and a positive total.
    return total !== null && total > 0 ? finite(amount(s)! / total, "segment.share") : null;
  });
  if (shares.some((s) => s === null)) return unavailable("shares_unavailable", "segment revenue share unavailable; primary activity not assumed");
  const largest = Math.max(...shares as number[]);
  const primary = segments.filter((_, i) => shares[i] === largest);
  const prohibited = c.treatmentRuleData.prohibited_categories as string[];
  const fails = primary.some((s) => prohibited.includes(s.activityCategory));
  // D-80 applies whenever ANY tied primary is prohibited, even alongside unclassified.
  if (primary.length > 1 && fails) return unavailable("primary_tied", "primary activity tied between segments");
  if (primary.some((s) => s.activityCategory === "unclassified")) {
    return unavailable("unclassified_primary", "primary activity is unclassified"); // D-13/D-61
  }
  result.result = fails ? "fail" : "pass";
  result.ratio = fails ? 1 : 0;
  result.resultReasonCode = fails ? "primary_prohibited" : "primary_permissible";
  result.calculationTrace = `Primary activity: ${primary.map((s) => `${s.segmentName} (${s.activityCategory})`).join(", ")}; ${result.result}.`;
  return { criterion: result, unknowns: [] };
};

const nonPermissibleRevenue: Evaluator = (c, input) => {
  const segments = [...input.segments].sort((a, b) => compareCodePoints(a.segmentName, b.segmentName));
  const categories = c.treatmentRuleData.non_permissible_categories as string[];
  // Even permissible segments need amounts/categories to establish an exhaustive numerator.
  const unavailable = segments.length === 0 || segments.some((s) => s.activityCategory === "unclassified" || amount(s) === null);
  const numerator = unavailable ? null : segments.reduce((sum, s) =>
    add(sum, categories.includes(s.activityCategory) ? amount(s)! : 0), 0);
  const denominator = factSum(["total_revenue"], input.facts);
  return finishRatio(c, numerator, denominator.value, combine(segmentEvidence(segments), denominator), input.engineVersion,
    segments.length === 0 ? "no_segments" : "numerator_unavailable"); // D-86
};

/** Registered types only; arbitrary unknown names (including object keys) safely block. */
export const evaluatorRegistry: ReadonlyMap<string, Evaluator> = new Map([
  ...ratioTypes.map((type): [string, Evaluator] => [type, ratio]),
  ["business_activity", businessActivity],
  ["non_permissible_revenue", nonPermissibleRevenue],
]);
export function evaluate(c: Criterion, input: EngineInput): Evaluation {
  const evaluator = evaluatorRegistry.get(c.criterionType);
  if (evaluator) return evaluator(c, input);
  const criterion = base(c, { states: [], tiers: [], sources: [] });
  criterion.resultReasonCode = "evaluator_unregistered";
  criterion.calculationTrace = `no evaluator is registered for ${c.criterionType}`;
  return { criterion, unknowns: [unknown(c, c.label, "blocking", "evaluator_unregistered", criterion.calculationTrace)] };
}
