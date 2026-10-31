import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapAnnual } from "../src/ingest/sec/annual";
import { candidates, SEC_CALCULATION_VERSION } from "../src/ingest/sec/mapping";
import { annual, entries, selectAnnual } from "../src/ingest/sec/selection";
import type { Fixture, Observation } from "../src/ingest/sec/types";
import { legacyLaunchFact } from "../scripts/sec/legacy-launch-mapping";
import { screen, verify } from "../src/engine";
import { goldenInput } from "../src/engine/__fixtures__/synthetic";
import { MARKET_VALUE_CALCULATION_VERSION } from "../src/lib/financial/market-value-persistence";
import { verifyStoredRun } from "../src/screening/verify";
import type { HashPayload } from "../src/db/schema/types";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
const load = (ticker: string): Fixture => JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}.json`, "utf8"));
const expected = JSON.parse(readFileSync("tests/fixtures/sec/launch/results.json", "utf8"));
const income: Record<string, number | null> = { AAPL: null, MSFT: null, AVGO: 347000000, CSCO: 866000000,
  QCOM: 639000000, NFLX: null, COST: 711000000, HD: 124000000, AMD: null, TXN: null, PEP: null, LLY: null };
const mapped = (f: Fixture, line: string) => mapAnnual(f.companyfacts, f.metadata).facts.find(v => v.line_item === line)!;
function replace(f: Fixture, tag: string, val: number, changes: Partial<Observation> = {}, unit = "USD") {
  const p = selectAnnual(f.companyfacts);
  f.companyfacts.facts["us-gaap"][tag] = { units: { [unit]: [{
    val, start: p.start, end: p.end, accn: p.accn, form: "10-K", fp: "FY", fy: p.fiscalYear, filed: p.filed, ...changes,
  }] } };
}
describe("genuine full-capture launch regressions", () => {
  it.each(Object.keys(expected))("%s retains selection, original .4 baseline and deterministic .6 mapping", ticker => {
    const f = load(ticker);
    const original = JSON.stringify(f);
    const before: ReturnType<typeof mapAnnual> = JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}-before.json`, "utf8"));
    const after = mapAnnual(f.companyfacts, f.metadata);
    expect(after).toEqual({ calculation_version: SEC_CALCULATION_VERSION, ...expected[ticker] });
    expect(after.period).toEqual(before.period);
    for (const line of ["prohibited_income", "net_income", "interest_bearing_debt"]) {
      const old = before.facts.find(v => v.line_item === line)!;
      expect(legacyLaunchFact(f.companyfacts, line)).toEqual({
        value: old.value, input_state: old.input_state, unknown_note: old.unknown_note,
      });
    }
    expect(JSON.stringify(f)).toBe(original);
    expect(f.metadata.original_sha256).toMatch(/^[a-f0-9]{64}$/);
    // Ordering of source observation arrays is never authority.
    for (const concepts of Object.values(f.companyfacts.facts))
      for (const c of Object.values(concepts)) for (const rows of Object.values(c.units)) rows.reverse();
    expect(mapAnnual(f.companyfacts, f.metadata)).toEqual(after);
  });
  it.each(Object.entries(income))("%s income is exact-period evidence or unknown, never zero-by-absence", (ticker, value) => {
    const f = load(ticker), result = mapped(f, "prohibited_income");
    expect(result).toMatchObject({ value, input_state: value === null ? "unknown" : "estimated", confidence_tier: "Estimated" });
    if (value !== null) {
      expect(result.mapping_note).toContain("not a complete gross prohibited-income total");
      expect(result.source?.is_synthetic).toBe(false);
    }
  });
  it("discloses combined dividends, broader ancillary income and consolidated AVGO net-income scope", () => {
    expect(mapped(load("QCOM"), "prohibited_income").mapping_note).toContain("source combines interest and dividends");
    expect(mapped(load("COST"), "prohibited_income").mapping_note).toContain("broader source includes ancillary other income and may be net");
    const avgo = load("AVGO");
    expect(entries(avgo.companyfacts, "NetIncomeLossAttributableToParent")).toHaveLength(0);
    expect(mapped(avgo, "net_income")).toMatchObject({ value: 23126000000, input_state: "reported", confidence_tier: "Verified" });
    expect(mapped(avgo, "net_income").mapping_note).toContain("including noncontrolling interests, not parent-attributable");
  });
  it.each(["AMD", "TXN", "PEP", "LLY"])("%s original interest is stale or nonannual, not an invalid 52-week year", ticker => {
    const f = load(ticker), p = selectAnnual(f.companyfacts);
    expect(annual(p)).toBe(true);
    const rows = entries(f.companyfacts, "InvestmentIncomeInterest");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some(e => annual(e) && e.unit === "USD" && e.start === p.start && e.end === p.end)).toBe(false);
    expect(mapped(f, "prohibited_income").value).toBeNull();
  });
  it("ordered proxies never skip a negative/net expense to manufacture gross income", () => {
    expect(candidates.prohibited_income).toEqual(["InvestmentIncomeInterest", "InvestmentIncomeInterestAndDividend", "InterestIncomeOther", "InterestAndOtherIncome"]);
    const f = load("AVGO");
    replace(f, "InterestAndOtherIncome", 90);
    replace(f, "InvestmentIncomeInterestAndDividend", 80);
    replace(f, "InvestmentIncomeInterest", 70);
    expect(mapped(f, "prohibited_income").value).toBe(70);
    replace(f, "InvestmentIncomeInterest", -1);
    expect(mapped(f, "prohibited_income")).toMatchObject({ value: null, input_state: "unknown" });
    expect(mapped(f, "prohibited_income").unknown_note).toContain("negative");
    replace(f, "InvestmentIncomeInterest", 0);
    expect(mapped(f, "prohibited_income").value).toBe(0);
  });
  it.each([
    [{ start: "2025-08-04" }, "USD"], [{ form: "10-Q", fp: "Q3" }, "USD"],
    [{ start: "2023-11-04", end: "2024-11-02" }, "USD"], [{}, "EUR"],
    [{ start: "2024-11-03" }, "USD"],
  ] as [Partial<Observation>, string][])("rejects a fallback with incompatible metadata %j / %s", (changes, unit) => {
    const f = load("AVGO");
    delete f.companyfacts.facts["us-gaap"].InterestIncomeOther;
    replace(f, "InvestmentIncomeInterestAndDividend", 123, changes, unit);
    expect(mapped(f, "prohibited_income").value).toBeNull();
  });
  it.each(["ORCL", "JNJ"])("%s debt uses verified carrying values without overlapping totals or leases", ticker => {
    const f = load(ticker), debt = mapped(f, "interest_bearing_debt");
    expect(debt.value).toBe(ticker === "ORCL" ? 129541000000 : 47933000000);
    expect(debt).toMatchObject(ticker === "ORCL" ? { input_state: "estimated", confidence_tier: "Estimated" } :
      { input_state: "derived", confidence_tier: "Calculated" });
    expect(debt.mapping_note).toContain("filing-specific scope");
    if (ticker === "ORCL") expect(debt.mapping_note).toContain("No long-term debt tag found; total may be incomplete — analyst to confirm");
    // Lease and maturity values cannot change carrying debt.
    replace(f, "LongTermDebtAndCapitalLeaseObligations", 999999, { start: undefined });
    replace(f, "LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths", 999999, { start: undefined });
    expect(mapped(f, "interest_bearing_debt")).toEqual(debt);
  });
  it("note aliases cannot satisfy D-116 and unusable selected notes invalidate the entire sum", () => {
    const f = load("ORCL");
    replace(f, "LongTermNotesPayable", 5, { start: undefined });
    replace(f, "NotesPayableCurrent", 2, { start: undefined }, "EUR");
    expect(mapped(f, "interest_bearing_debt")).toMatchObject({ value: null, input_state: "unknown" });
    replace(f, "NotesPayableCurrent", 0, { start: undefined });
    expect(mapped(f, "interest_bearing_debt")).toMatchObject({ value: 5, input_state: "estimated", confidence_tier: "Estimated" });
    delete f.companyfacts.facts["us-gaap"].LongTermNotesPayable;
    delete f.companyfacts.facts["us-gaap"].NotesPayableCurrent;
    expect(mapped(f, "interest_bearing_debt").value).toBeNull();
  });
  it("does not carry a filing-specific overlap interpretation into a different filing", () => {
    const f = load("JNJ");
    for (const concepts of Object.values(f.companyfacts.facts))
      for (const c of Object.values(concepts)) for (const rows of Object.values(c.units))
        for (const r of rows) if (r.accn === "0000200406-26-000016") r.accn = "0000200406-26-000017";
    const note = mapped(f, "interest_bearing_debt").mapping_note;
    expect(note).not.toContain("JNJ note 7");
    expect(note).toContain("LongTermDebt = 41438000000");
  });
  it.each(["calc-2026.10.1", "calc-2026.10.2", "calc-2026.10.3", "calc-2026.10.4", "calc-2026.10.5", "calc-2026.10.6"])("supports immutable screening replay for %s", calculationVersion => {
    const input = goldenInput("A", "pass");
    input.calculationVersion = calculationVersion;
    for (const engineVersion of ["engine-1.0.1", "engine-1.0.2"]) {
      const result = screen({ ...input, engineVersion });
      expect(verify(result.hashPayload, result.immutableHash)).toBe(true);
      expect(verifyStoredRun({ hash_payload: result.hashPayload as HashPayload, immutable_hash: result.immutableHash }))
        .toMatchObject({ valid: true, hashMatches: true, replayMatches: true });
    }
    expect(MARKET_VALUE_CALCULATION_VERSION).toBe("calc-2026.10.5");
  });
});
