import { z } from "zod";
import { combine, factSum, type Evidence } from "./evidence";
import { decimal } from "./math";
import type { Criterion, EngineInput } from "./types";

/** D-154: the rate is required versioned configuration, never a code default. */
export const upperBoundPolicySchema = z.object({
  annual_yield_assumption: z.number().finite().positive().max(1),
  cash_line_item: z.string().min(1), short_term_line_item: z.string().min(1),
  long_term_line_item: z.string().min(1), eligibility_line_item: z.string().min(1),
  explanation: z.string().min(1),
}).strict();
export type UpperBoundPolicy = z.infer<typeof upperBoundPolicySchema>;
type Decimal = ReturnType<typeof decimal>;
function sum(values: number[]): Decimal {
  const parts = values.map(decimal), scale = Math.max(...parts.map(part => part.scale));
  return { coefficient: parts.reduce((total, part) => total + part.coefficient * 10n ** BigInt(scale - part.scale), 0n), scale };
}
function product(...parts: Decimal[]): Decimal {
  return { coefficient: parts.reduce((total, part) => total * part.coefficient, 1n),
    scale: parts.reduce((total, part) => total + part.scale, 0) };
}
function leq(a: Decimal, b: Decimal) {
  const scale = Math.max(a.scale, b.scale);
  return a.coefficient * 10n ** BigInt(scale - a.scale) <= b.coefficient * 10n ** BigInt(scale - b.scale);
}
type BoundCalculation = { bound: number | null; ratio: number | null; passes: boolean; reason: string | null };
export function calculateUpperBound(policy: UpperBoundPolicy, values: (number | null)[], revenue: number | null, threshold: number): BoundCalculation {
  if (values.length !== 3 || values.some(value => value === null || !Number.isFinite(value) || value < 0) ||
    revenue === null || !Number.isFinite(revenue) || revenue <= 0)
    return { bound: null, ratio: null, passes: false, reason: "Incomplete asset evidence or unusable annual revenue" };
  const assets = sum(values as number[]);
  const exactBound = product(assets, decimal(policy.annual_yield_assumption));
  const bound = Number(exactBound.coefficient) * 10 ** -exactBound.scale;
  const ratio = bound / revenue * 100;
  if (!Number.isFinite(bound) || !Number.isFinite(ratio) || (bound === 0 && exactBound.coefficient !== 0n))
    return { bound: null, ratio: null, passes: false, reason: "Unrepresentable upper-bound calculation" };
  const passes = leq(product(exactBound, decimal(100)), product(decimal(revenue), decimal(threshold)));
  return { bound, ratio, passes, reason: passes ? null : "Upper bound exceeds the limit; actual income remains unknown" };
}
export type UpperBoundEvaluation = ReturnType<typeof calculateUpperBound> & { evidence: Evidence; trace: string };
export function upperBoundFallback(c: Criterion, input: EngineInput): UpperBoundEvaluation | null {
  const raw = c.treatmentRuleData.suhail_upper_bound;
  if (raw === undefined || factSum(c.numeratorLineItems, input.facts).value !== null) return null;
  const policy = upperBoundPolicySchema.parse(raw);
  const keys = [policy.cash_line_item, policy.short_term_line_item, policy.long_term_line_item];
  const parts = keys.map(key => factSum([key], input.facts));
  const revenue = factSum(c.denominatorLineItems, input.facts);
  const eligible = factSum([policy.eligibility_line_item], input.facts);
  const calculation = calculateUpperBound(policy, parts.map(part => part.value), revenue.value, c.threshold!);
  const permitted = eligible.value === 1;
  return {
    ...calculation,
    bound: permitted ? calculation.bound : null,
    passes: permitted && calculation.passes,
    reason: permitted ? calculation.reason : "Protected income decision or eligibility not verified",
    evidence: combine(...parts, revenue, eligible, { states: ["estimated"], tiers: ["Estimated"], sources: [] }),
    trace: `${policy.explanation} Annual yield assumption=${policy.annual_yield_assumption * 100}%; ` +
      keys.map((key, i) => `${key}=${parts[i].value ?? "unknown"}`).join("; ") +
      `; total_revenue=${revenue.value ?? "unknown"}; upper bound=${permitted ? calculation.bound ?? "unknown" : "unknown"}; ` +
      `ratio_percent=${permitted ? calculation.ratio ?? "unknown" : "unknown"}; ` +
      `eligibility=${eligible.value ?? "unverified"}. Inputs and filing references are retained with this criterion.`,
  };
}
