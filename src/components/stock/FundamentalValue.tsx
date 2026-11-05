import type { StockFact } from "@/stock/types";
import { formatFullDollars, formatMoney, formatNumber, scaleMultiplier } from "@/lib/format";
import { Num } from "../foundation";
import { Bilingual, Label } from "./StockVerdictParts";

/** UI-2: presentation scaling only; the source fact and its units stay unchanged. */
export function FundamentalValue({ fact, locale }: { fact: StockFact; locale: "ar" | "en" }) {
  if (fact.value === null) return fact.value_text
    ? <Bilingual locale={locale} arabic={null} english={fact.value_text} /> : <>—</>;
  const multiplier = scaleMultiplier(fact.unit_scale);
  if (multiplier === null) return <><Num>{formatNumber(fact.value, locale)}</Num>{" "}
    {fact.currency && <bdi>{fact.currency}</bdi>}{" "}<Label family="scale" value={fact.unit_scale} locale={locale} /></>;
  const value = fact.value * multiplier;
  return <Num>{fact.currency === "USD" ? formatFullDollars(value)
    : fact.currency ? formatMoney(value, "en", fact.currency, 1) : formatNumber(value, locale)}</Num>;
}
