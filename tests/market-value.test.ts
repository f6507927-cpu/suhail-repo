import { describe, expect, it } from "vitest";
import { completedQuarter, deriveMarketValue, selectMonthEnd } from "../src/lib/financial/market-value";
import type { financialFact, priceBar } from "../src/db/schema/market";

type Fact = typeof financialFact.$inferSelect;
type Price = typeof priceBar.$inferSelect;
const fact = (value: number | null, extra: Partial<Fact> = {}) => ({
  id: "fact", value, input_state: value === null ? "unknown" : "reported", confidence_tier: "Verified",
  source_id: "filing-source", as_of_date: "2026-07-01", ...extra,
} as Fact);
const price = (month: string, date: string, close = 10, extra: Partial<Price> = {}) => ({
  id: month, month_end_for: month, date, close, currency: "USD", source_id: `source-${month}`,
  created_at: new Date("2026-10-01"), is_synthetic: false, ...extra,
} as Price);
const prices = [price("2026-07-31", "2026-07-31"), price("2026-08-31", "2026-08-31", 20), price("2026-09-30", "2026-09-30", 30)];

describe("D-122 data-layer market value evidence", () => {
  it.each(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"])("selects latest, fallback and nothing older at %s", asOf => {
    const latest = completedQuarter(asOf);
    const previous = completedQuarter(latest.monthEnds[0].slice(0, 7) + "-01");
    const tooOld = completedQuarter(previous.monthEnds[0].slice(0, 7) + "-01");
    const bars = (q: typeof latest) => q.monthEnds.map(end => price(end, end));
    expect(deriveMarketValue(asOf, [...bars(previous), ...bars(latest)], fact(10), fact(1)).quarter).toEqual(latest);
    const fallback = deriveMarketValue(asOf, [...bars(previous), ...bars(latest).slice(1)], fact(10), fact(1));
    expect(fallback).toMatchObject({ value: 100, input_state: "estimated", confidence_tier: "Estimated", quarter: previous });
    expect(fallback.trace.freshnessNote).toBe(`prices from ${previous.label}`);
    expect(fallback.trace.stale).toBe(true);
    expect(deriveMarketValue(asOf, bars(tooOld), fact(10), fact(100000)).value).toBeNull();
    expect(deriveMarketValue(asOf, bars(previous).slice(1), fact(10), fact(1)).value).toBeNull();
  });
  it("multiple-class evidence prevents even an equity-floor shortcut", () => {
    expect(deriveMarketValue("2026-10-16", prices, fact(10, { shares_class_concern: true }), fact(100000)).value).toBeNull();
    expect(deriveMarketValue("2026-10-16", prices, fact(10, { shares_class_concern: false }), fact(100000)).value).toBe(100000);
  });
  it.each([
    ["2026-10-01", ["2026-07-31", "2026-08-31", "2026-09-30"]],
    ["2026-09-30", ["2026-04-30", "2026-05-31", "2026-06-30"]],
    ["2026-01-01", ["2025-10-31", "2025-11-30", "2025-12-31"]],
    ["2024-04-01", ["2024-01-31", "2024-02-29", "2024-03-31"]],
  ])("resolves completed calendar quarter at %s", (asOf, ends) => expect(completedQuarter(asOf).monthEnds).toEqual(ends));
  it("refuses invalid caller dates", () => expect(() => completedQuarter("2026-02-30")).toThrow());
  it.each([[400, 400], [100, 200], [0, 200], [-1, 200]])("equity %s chooses %s", (equity, value) => {
    const actual = deriveMarketValue("2026-10-16", prices, fact(10), fact(equity));
    expect(actual).toMatchObject({ value, input_state: "derived", confidence_tier: "Calculated" });
    expect(actual.trace.average).toBe(200);
    expect(actual.trace.sourceIds).toHaveLength(4);
    expect(actual.trace.months.map(m => m.marketValue)).toEqual([100, 200, 300]);
    expect(actual.trace.shares?.as_of_date).toBe("2026-07-01");
  });
  it("missing equity does not become a zero floor", () => {
    for (const equity of [undefined, fact(null), fact(100, { input_state: "unknown" })])
      expect(deriveMarketValue("2026-10-16", prices, fact(10), equity)).toMatchObject({ value: null, input_state: "unknown" });
  });
  it("missing shares/required prices cannot pass", () => {
    for (const shares of [undefined, fact(null), fact(0), fact(-1)])
      expect(deriveMarketValue("2026-10-16", prices, shares, fact(100)).value).toBeNull();
    for (let i = 0; i < 3; i++)
      expect(deriveMarketValue("2026-10-16", prices.filter((_, n) => n !== i), fact(10), fact(100)).value).toBeNull();
  });
  it("propagates estimated state and weakest tier", () => {
    expect(deriveMarketValue("2026-10-16", prices, fact(10, { input_state: "estimated", confidence_tier: "Estimated" }), fact(100)))
      .toMatchObject({ value: 200, input_state: "estimated", confidence_tier: "Estimated" });
    expect(deriveMarketValue("2026-10-16", prices, fact(10), fact(100, { confidence_tier: "AI Interpretation" })))
      .toMatchObject({ confidence_tier: "AI Interpretation" });
    expect(deriveMarketValue("2026-10-16", prices.map(p => ({ ...p, source_tier: "Estimated" })), fact(10), fact(100)))
      .toMatchObject({ value: 200, input_state: "estimated", confidence_tier: "Estimated" });
  });
  it("refuses unlinked evidence and incompatible prices rather than inventing a basis", () => {
    expect(deriveMarketValue("2026-10-16", prices, fact(10, { source_id: null }), fact(100)).value).toBeNull();
    expect(deriveMarketValue("2026-10-16", prices, fact(10), fact(100, { source_id: null })).value).toBeNull();
    for (const extra of [{ source_id: null }, { currency: "EUR" }, { close: 0 }, { close: null }])
      expect(deriveMarketValue("2026-10-16", [{ ...prices[0], ...extra }, ...prices.slice(1)], fact(10), fact(100)).value).toBeNull();
  });
  it("requires explicit holiday/weekend last-trading-day evidence within the month", () => {
    const p = price("2026-05-31", "2026-05-29");
    expect(selectMonthEnd([p], "2026-05-31")?.id).toBe(p.id);
    expect(selectMonthEnd([{ ...p, month_end_for: null }], "2026-05-31")).toBeUndefined();
    expect(selectMonthEnd([{ ...p, date: "2026-04-30" }], "2026-05-31")).toBeUndefined();
    const holiday = price("2027-05-31", "2027-05-28");
    expect(selectMonthEnd([holiday], "2027-05-31")).toBe(holiday);
  });
  it("takes deterministic corrections, not the highest or arbitrary earlier close", () => {
    const first = prices[0], correction = { ...first, id: "z", close: 12, created_at: new Date("2026-10-02") };
    expect(selectMonthEnd([correction, first], first.month_end_for!)).toBe(correction);
    expect(selectMonthEnd([first, correction], first.month_end_for!)).toBe(correction);
    expect(selectMonthEnd([first, { ...first, id: "z" }], first.month_end_for!)?.id).toBe("z");
  });
});
