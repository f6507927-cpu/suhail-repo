import { decimal, finite } from "../../engine/math";

export function roundDecimal(value: number, places: number) {
  const { coefficient, scale } = decimal(value);
  const shift = scale - places;
  if (shift <= 0) return value;
  const negative = coefficient < 0n, n = negative ? -coefficient : coefficient;
  const divisor = 10n ** BigInt(shift);
  const result = n / divisor + (n % divisor * 2n >= divisor ? 1n : 0n);
  return Number(`${negative ? "-" : ""}${result}e-${places}`);
}

/** D-189: use the engine's exact decimal decomposition, including exponents. */
export function decimalCalculation(a: number, b: number, operation: "ratio" | "growth", multiplier: number) {
  const aa = decimal(a), bb = decimal(b);
  const scale = Math.max(aa.scale, bb.scale);
  const av = aa.coefficient * 10n ** BigInt(scale - aa.scale);
  const bv = bb.coefficient * 10n ** BigInt(scale - bb.scale);
  if (bv === 0n) throw new Error("Zero denominator");
  const numerator = (operation === "growth" ? av - bv : av) * BigInt(multiplier);
  // Six decimal places, half away from zero; never binary multiplication/division.
  const negative = (numerator < 0n) !== (bv < 0n);
  const n = (numerator < 0n ? -numerator : numerator) * 1_000_000n;
  const d = bv < 0n ? -bv : bv;
  const rounded = n / d + (n % d * 2n >= d ? 1n : 0n);
  return finite(Number(`${negative ? "-" : ""}${rounded}e-6`), "research derivation");
}
