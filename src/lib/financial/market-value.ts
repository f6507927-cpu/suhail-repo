import type { financialFact, priceBar } from "../../db/schema/market";
import type { ConfidenceTier } from "../../engine/types";

type Fact = typeof financialFact.$inferSelect;
type Price = typeof priceBar.$inferSelect;
export type PriceEvidence = Price & { source_tier?: ConfidenceTier };
const tiers: ConfidenceTier[] = ["Verified", "Calculated", "Estimated", "AI Interpretation"];

/** D-122: caller's calendar date, never a module clock or a rolling window. */
export function completedQuarter(asOf: string) {
  const d = new Date(`${asOf}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== asOf)
    throw new Error("Invalid market-value asOf");
  const start = Math.floor(d.getUTCMonth() / 3) * 3;
  const ends = [start - 2, start - 1, start].map(m =>
    new Date(Date.UTC(d.getUTCFullYear(), m, 0)).toISOString().slice(0, 10));
  return { label: `${ends[2].slice(0, 4)} Q${Math.ceil(Number(ends[2].slice(5, 7)) / 3)}`, monthEnds: ends };
}

/** Explicit month-end evidence, not "most recent price on or before month-end". */
export function comparePriceCorrections(a: PriceEvidence, b: PriceEvidence) {
  return +new Date(b.created_at) - +new Date(a.created_at) || b.id.localeCompare(a.id);
}
export function selectMonthEnd(prices: PriceEvidence[], monthEnd: string) {
  return prices.filter(p => p.month_end_for === monthEnd &&
    p.date.slice(0, 7) === monthEnd.slice(0, 7) && p.date <= monthEnd)
    .sort(comparePriceCorrections)[0];
}

export function deriveMarketValue(asOf: string, prices: PriceEvidence[], shares?: Fact, equity?: Fact) {
  const latest = completedQuarter(asOf);
  const previous = completedQuarter(latest.monthEnds[0].slice(0, 7) + "-01");
  const complete = (q: typeof latest) => q.monthEnds.every(end => {
    const p = selectMonthEnd(prices, end);
    return p?.source_id && p.close !== null && Number.isFinite(p.close) && p.close > 0 && p.currency === "USD";
  });
  // Launch extension of D-122: at most one completed-quarter fallback.
  const quarter = complete(latest) ? latest : complete(previous) ? previous : latest;
  const stale = quarter.label !== latest.label;
  const usable = (f?: Fact) => !!f && f.value !== null && Number.isFinite(f.value) &&
    !["unknown", "missing"].includes(f.input_state) && !!f.source_id;
  const gaps: string[] = [];
  if (!usable(shares) || shares!.value! <= 0) gaps.push("Latest sourced shares outstanding unavailable or nonpositive");
  if (shares?.shares_class_concern) gaps.push("Latest cover page explicitly reports multiple share classes/members or aggregated shares; no allocation assumed");
  if (!usable(equity)) gaps.push("Mapped sourced equity unavailable");
  const months = quarter.monthEnds.map(monthEnd => {
    const p = selectMonthEnd(prices, monthEnd);
    const known = !!p?.source_id && p.close !== null && Number.isFinite(p.close) && p.close > 0 && p.currency === "USD";
    if (!known) gaps.push(`No sourced last-trading-day close attested for ${monthEnd}`);
    return { monthEnd, price: p ?? null, marketValue: known && usable(shares) && shares!.value! > 0 ? p!.close! * shares!.value! : null };
  });
  const average = months.every(m => m.marketValue !== null) ? months.reduce((s, m) => s + m.marketValue!, 0) / 3 : null;
  const value = gaps.length || average === null ? null : equity!.value! <= 0 ? average : Math.max(average, equity!.value!);
  if (value !== null && !Number.isFinite(value)) throw new Error("Market-value arithmetic overflow");
  const sourceIds = [...new Set([...months.flatMap(m => m.price?.source_id ? [m.price.source_id] : []),
    ...[shares, equity].flatMap(f => f?.source_id ? [f.source_id] : [])])].sort();
  const tier = tiers[Math.max(1, ...[shares, equity].map(f => f ? tiers.indexOf(f.confidence_tier) : 2),
    ...months.map(m => tiers.indexOf(m.price?.source_tier ?? "Verified")))];
  const estimated = stale || [shares, equity].some(f => f?.input_state === "estimated") ||
    months.some(m => m.price?.is_synthetic || m.price?.source_tier === "Estimated");
  const trace = { rule: "D-122 launch rollover", quarter, stale, freshnessNote: stale ? `prices from ${quarter.label}` : null, months, shares: shares ?? null, equity: equity ?? null,
    average, equityFloor: usable(equity) && equity!.value! > 0 ? equity!.value : null,
    chosenBasis: value, sourceIds, gaps };
  return { value, input_state: value === null ? "unknown" as const : estimated ? "estimated" as const : "derived" as const,
    confidence_tier: value === null ? "Estimated" as const : estimated ? tiers[Math.max(2, tiers.indexOf(tier))] : tier,
    trace, unknown_note: gaps.join("; ") || null, quarter };
}
