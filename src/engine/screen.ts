import { hash } from "./canonical";
import { evaluate } from "./evaluators";
import { projectPayload } from "./payload";
import { buildReasons } from "./reasons/structured";
import type { EngineInput, EngineResult, Status } from "./types";
import { dateMillis, validate } from "./validate";

/** Pure: dates are explicit; no IO, clock lookup, random or database dependency. */
export function screen(input: EngineInput): EngineResult {
  validate(input);
  const evaluations = input.methodologyVersion.criteria.map((c) => evaluate(c, input));
  const criteria = evaluations.map((e) => e.criterion);
  const unknowns = evaluations.flatMap((e) => e.unknowns);
  const stale = (dateMillis(input.asOf, "asOf") - dateMillis(input.period.periodEnd, "period.periodEnd")) / 86_400_000 > (input.stalenessLimitDays ?? 550);
  if (stale) unknowns.push({
    criterionId: null, label: "Data freshness", field: "Data freshness",
    severity: "review", reasonCode: "stale_data",
    explanation: "The financial period is older than the configured staleness limit.",
  });
  const blocking = unknowns.some((u) => u.severity === "blocking");
  let status: Status;
  if (criteria.some((c) => c.result === "fail")) status = "fails_selected_methodology";
  else if (blocking) status = "insufficient_data";
  else if (criteria.some((c) => c.result === "unknown" || c.result === "borderline") ||
           unknowns.some((u) => u.severity === "review")) status = "requires_review";
  else status = "passes_selected_methodology";
  // §7.1: tier is not state. AI Interpretation alone does not imply unknown.
  // D-87/D-88: only used facts, all supplied segments, missing states and freshness.
  const states = [...criteria.flatMap((c) => c.inputStates), ...input.segments.map((s) => s.inputState)];
  const absent = states.some((s) => s === "unknown" || s === "missing");
  const estimates = states.includes("estimated") || stale;
  const quality: Pick<EngineResult, "status" | "dataAdequacy" | "confidence"> = {
    status,
    dataAdequacy: blocking ? "inadequate" : absent || estimates ? "adequate_with_estimates" : "adequate",
    confidence: blocking || absent ? "Low" : estimates ? "Medium" : "High",
  };
  const statusReasons = buildReasons(status, criteria, unknowns);
  const hashPayload = projectPayload(input, { ...quality, criteria, unknowns, statusReasons });
  const immutableHash = hash(hashPayload);
  return {
    ...quality, criteria, unknowns, statusReasons,
    hashPayload, immutableHash, financialSnapshotId: `snap_${input.period.id}_${immutableHash.slice(0, 12)}`,
  };
}
