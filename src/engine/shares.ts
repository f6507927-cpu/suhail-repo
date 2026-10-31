import type { Segment } from "./types";
import { amount, share } from "./evidence";
import { add, decimal } from "./math";
import { EngineInputError } from "./errors";

/** D-92: exact decimal half-unit envelope for independently rounded 6dp shares. */
export function validateShares(segments: Segment[]): void {
  const disclosed = segments.map(share).filter((v): v is number => v !== null);
  if (disclosed.length === 0) return;
  const amounts = segments.map(amount);
  // Preserve D-84/D-85: unavailable evidence never becomes zero or a guessed basis.
  const basis = amounts.some(v => v === null) ? null : amounts.reduce<number>((a, b) => add(a, b!), 0);
  const numbers = [...disclosed, 1, ...(basis !== null && basis > 0 ? amounts as number[] : [])];
  const parts = numbers.map(decimal);
  const scale = Math.max(0, ...parts.map(p => p.scale));
  const integer = (v: number) => {
    const p = decimal(v);
    return p.coefficient * 10n ** BigInt(scale - p.scale);
  };
  const unit = integer(1);
  const total = disclosed.reduce((a, b) => a + integer(b), 0n);
  const difference = total - unit;
  const allowance = BigInt(disclosed.length) * unit;
  const complete = disclosed.length === segments.length;
  const abs = (v: bigint) => v < 0n ? -v : v;
  if ((difference > 0n && difference * 2_000_000n > allowance) ||
      (complete && abs(difference) * 2_000_000n > allowance))
    throw new EngineInputError("segments.revenueShare", "shares contradict a complete or partial revenue total");
  if (basis !== null && basis > 0) {
    const denominator = (amounts as number[]).reduce((a, b) => a + integer(b), 0n);
    for (const s of segments) {
      const value = share(s);
      if (value !== null && abs(integer(value) * denominator - integer(amount(s)!) * unit) * 2_000_000n > denominator * unit)
        throw new EngineInputError("segments.revenueShare", "share contradicts disclosed revenue proportions");
    }
  }
}
