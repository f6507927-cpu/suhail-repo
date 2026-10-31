import { compareCodePoints } from "./canonical";
import type { ConfidenceTier, EvidenceState, Fact, Segment } from "./types";
import { add } from "./math";

export interface Evidence {
  states: EvidenceState[];
  tiers: ConfidenceTier[];
  sources: string[];
}
export interface Sum extends Evidence { value: number | null }

export function factSum(keys: string[], facts: Fact[]): Sum {
  const used = keys.map((key) => facts.find((f) => f.lineItem === key));
  return {
    value: used.some((f) => !f || f.inputState === "unknown" || f.value === null)
      ? null : used.reduce((total, f) => add(total, f!.value!), 0),
    states: used.map((f) => f ? f.inputState : "missing"),
    tiers: used.flatMap((f) => f ? [f.confidenceTier] : []),
    sources: used.flatMap((f) => f ? [f.sourceId] : []),
  };
}
export function segmentEvidence(segments: Segment[]): Evidence {
  return {
    states: segments.length === 0 ? ["missing"] : segments.map((s) => s.inputState),
    tiers: segments.map((s) => s.confidenceTier),
    sources: segments.map((s) => s.sourceId),
  };
}
export function combine(...evidence: Evidence[]): Evidence {
  return {
    states: evidence.flatMap((e) => e.states),
    tiers: evidence.flatMap((e) => e.tiers),
    sources: evidence.flatMap((e) => e.sources),
  };
}
export function weakest(tiers: ConfidenceTier[]): ConfidenceTier | null {
  const order: ConfidenceTier[] = ["Verified", "Calculated", "Estimated", "AI Interpretation"];
  return tiers.length === 0 ? null : order[Math.max(...tiers.map((t) => order.indexOf(t)))];
}
export function distinct<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort(compareCodePoints);
}
/** D-84: supplied numeric segment values cannot override an unknown state. */
export function amount(s: Segment): number | null {
  return s.inputState === "unknown" ? null : s.revenueAmount;
}
export function share(s: Segment): number | null {
  return s.inputState === "unknown" ? null : s.revenueShare;
}
