import type { Criterion, CriterionResultCode, ReasonCode } from "./types";
import { EngineInputError } from "./errors";

export function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new EngineInputError(field, "non-finite calculated value or arithmetic overflow");
  return value;
}
export function add(a: number, b: number): number {
  return finite(a + b, "sum");
}

export function decimal(value: number): { coefficient: bigint; scale: number } {
  finite(value, "decimal");
  const [mantissa, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length - Number(exponent) };
}
function withinMargin(value: number, threshold: number, margin: number): boolean {
  const parts = [value, threshold, margin].map(decimal);
  const scale = Math.max(...parts.map((p) => p.scale));
  const [v, t, m] = parts.map((p) => p.coefficient * 10n ** BigInt(scale - p.scale));
  const distance = v >= t ? v - t : t - v;
  return distance <= m;
}
/** Decimal half-away-from-zero, without binary .xx5 tie drift (e.g. 1.005). */
export function roundRatio(value: number): number {
  finite(value, "ratio");
  const [mantissa, exponent = "0"] = Math.abs(value).toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const digits = BigInt(whole + fraction);
  const shift = Number(exponent) - fraction.length + 2;
  let rounded: bigint;
  if (shift >= 0) rounded = digits * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    rounded = digits / divisor + (digits % divisor * 2n >= divisor ? 1n : 0n);
  }
  const magnitude = finite(Number(`${rounded}e-2`), "roundedRatio");
  return magnitude === 0 ? 0 : value < 0 ? -magnitude : magnitude;
}

export function decide(ratio: number, c: Criterion): { result: CriterionResultCode; reasonCode: ReasonCode } {
  if (c.thresholdDirection === "boolean" || c.threshold === null) {
    return ratio > 0
      ? { result: "fail", reasonCode: "boolean_positive" }
      : { result: "pass", reasonCode: "boolean_nonpositive" };
  }
  // Exact decimal distance, without re-rounding threshold/margin or binary drift.
  if (c.borderlineMargin !== null && withinMargin(ratio, c.threshold, c.borderlineMargin)) {
    return { result: "borderline", reasonCode: "within_margin" };
  }
  if (c.thresholdDirection === "max") return ratio <= c.threshold
    ? { result: "pass", reasonCode: "max_within_limit" }
    : { result: "fail", reasonCode: "max_exceeded" };
  return ratio >= c.threshold
    ? { result: "pass", reasonCode: "min_met" }
    : { result: "fail", reasonCode: "min_not_met" };
}

export function formatNumber(value: number): string {
  const [integer, fraction] = value.toString().split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction === undefined ? "" : `.${fraction}`);
}
export function unitSuffix(unit: string): string {
  return unit.startsWith("percent_") ? "%" : "";
}
