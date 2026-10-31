import { formatNumber } from "@/lib/format";
import type { Locale } from "../accounts/types";

/** Display only. Never alter the run, its threshold or its evaluated result. */
export function ratioDisplay(value: number, threshold: number | null, failed: boolean, locale: Locale) {
  if (!Number.isFinite(value)) return "—";
  const rounded = (n: number, digits: number) => Number(n.toFixed(digits));
  const format = (n: number, digits: number) => formatNumber(n, locale, { maximumFractionDigits: digits });
  let digits = 2;
  const concealed = () => value !== 0 && rounded(value, digits) === 0
    || threshold !== null && value !== threshold && rounded(value, digits) === rounded(threshold, digits);
  if (failed) {
    while (digits < 6 && concealed()) digits++;
    if (concealed()) {
      // An exact mathematical bound, not an invented seventh decimal place.
      const boundary = threshold !== null && rounded(value, 6) === rounded(threshold, 6) ? threshold : 0;
      const bound = value > boundary ? Math.floor(boundary * 1e6) / 1e6 : Math.ceil(boundary * 1e6) / 1e6;
      return `${value > boundary ? ">" : "<"} ${format(bound, 6)}`;
    }
  }
  return format(value, digits);
}
