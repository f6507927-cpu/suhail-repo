import { formatNumber } from "@/lib/format";
import type { Locale } from "../accounts/types";

/** Display only. Never alter the run, its threshold or its evaluated result. */
export function ratioDisplay(value: number, threshold: number | null, failed: boolean, locale: Locale) {
  if (!Number.isFinite(value)) return "—";
  const rounded = (n: number) => Number(n.toFixed(2));
  const format = (n: number) => formatNumber(n, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // UX-2 fixes display precision at two decimals. Preserve D-138's truthful
  // distinction at failed boundaries with a mathematical bound, not extra digits.
  const sameThreshold = threshold !== null && value !== threshold && rounded(value) === rounded(threshold);
  if (failed && (sameThreshold || value !== 0 && rounded(value) === 0)) {
    const boundary = sameThreshold ? threshold! : 0;
    const bound = value > boundary ? Math.floor(boundary * 100) / 100 : Math.ceil(boundary * 100) / 100;
    return `${value > boundary ? ">" : "<"} ${format(bound)}`;
  }
  return format(value);
}
