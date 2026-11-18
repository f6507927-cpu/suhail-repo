import stocks from "./stocks.json";
import { buildResearchPacket } from "../../../src/ai/research/packet";
import type { PacketInput } from "../../../src/ai/research/contracts";

export const FIXTURE_CLOCK = "2026-11-01T12:00:00Z";
export const source = {
  id: "fixture-primary", label: "SYNTHETIC FIXTURE — not a real filing",
  url: "https://filing.example.invalid/annual", accession: "fixture-annual",
  // Deliberately models an eligible row. Tests separately prove real synthetic
  // flags are refused. There is no application bypass for these local fixtures.
  is_synthetic: false, production_blocked: false,
};
export function fixtureInput(index = 0): PacketInput {
  const s = stocks[index];
  const fact = (field: string, value: number | null, year = 2025) => ({
    field, value, unit: "USD", source, confidence_tier: "Verified" as const, date: `${year}-12-31`,
  });
  return {
    security: { id: s.ticker, ticker: s.ticker, name: s.name, sic: "3571", activity: "manufacturing",
      covered: true, in_universe: true, source, confidence_tier: "Verified", date: "2026-01-15" },
    periods: [
      { id: "FY2025", annual: true, period_end: "2025-12-31", reported_date: "2026-01-15",
        facts: [fact("total_revenue", s.revenue), fact("net_income", s.income), fact("gross_profit", 30000000),
          fact("operating_income", 18000000), fact("interest_bearing_debt", s.debt), fact("total_equity", s.equity),
          fact("operating_cash_flow", 15000000), fact("investing_cash_flow", -8000000),
          fact("financing_cash_flow", -2000000), fact("market_cap", 245000000)] },
      { id: "FY2024", annual: true, period_end: "2024-12-31", reported_date: "2025-01-15",
        facts: [fact("total_revenue", s.prior_revenue, 2024)] },
    ],
    prices: [{ month_end_for: "2026-10", close: s.close, currency: "USD", date: "2026-10-30", source, confidence_tier: "Verified" }],
    runs: [{
      methodology: "fixture-method", methodology_label: "Synthetic methodology", version: "fixture-version",
      production_enabled: true, status: s.status as PacketInput["runs"][number]["status"],
      source, confidence_tier: "Calculated", date: "2026-10-30", data_as_of: "2026-10-30",
      run_at: "2026-10-31T12:00:00Z", engine_version: "fixture-engine", calculation_version: "fixture-calculation",
      immutable_hash: `fixture-run-${s.ticker}`, reasons: [],
      criteria: [{ id: "debt", result: s.status === "fails_selected_methodology" ? "fail" : "pass",
        numerator: s.debt, denominator: 245000000, ratio: 8.163265, threshold: 33,
        unit: "percent_of_market_cap", numerator_unit: "USD", denominator_unit: "USD" }],
      unknowns: s.status === "insufficient_data" ? [{ id: "revenue", explanation: "No usable annual revenue" }] : [],
    }],
  };
}
/** Ten synthetic packet fixtures. Frozen hashes in hashes.json pin every item. */
export const fixturePackets = stocks.map((_s, i) => buildResearchPacket(fixtureInput(i), FIXTURE_CLOCK));
