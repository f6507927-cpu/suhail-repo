import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapAnnual } from "../src/ingest/sec/annual";
import { candidates, SEC_CALCULATION_VERSION } from "../src/ingest/sec/mapping";
import { annual, entries, selectAnnual } from "../src/ingest/sec/selection";
import type { CompanyFacts, Fixture, Observation } from "../src/ingest/sec/types";
import { screen, verify } from "../src/engine";
import { goldenInput } from "../src/engine/__fixtures__/synthetic";
import { validate } from "../src/engine/validate";

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/sec/${name}.json`, "utf8")) as Fixture;
const provenance = load("missing").metadata;
const accession = "9999999999-26-000001";
function observation(value: number, overrides: Partial<Observation> = {}): Observation {
  return { val: value, end: "2025-12-31", accn: accession, fy: 2025,
    fp: "FY", form: "10-K", filed: "2026-02-01", ...overrides };
}
function sample() { return structuredClone(load("missing").companyfacts); }
function add(data: CompanyFacts, tag: string, obs: Observation, unit = "USD") {
  const [ns, name] = tag.includes(":") ? tag.split(":") : ["us-gaap", tag];
  const concept = ((data.facts[ns] ??= {})[name] ??= { units: {} });
  (concept.units[unit] ??= []).push(obs);
}
function fact(data: CompanyFacts, line: string) {
  return mapAnnual(data, provenance).facts.find(f => f.line_item === line)!;
}

describe("genuine SEC fixture mapping", () => {
  it("uses only verified annual interest evidence as an explicitly incomplete estimated proxy", () => {
    const fixture = load("jpm");
    const p = fact(fixture.companyfacts, "prohibited_income");
    expect(p).toMatchObject({ value: 28032000000, input_state: "estimated", confidence_tier: "Estimated",
      as_of_date: "2025-12-31", source: { document_reference: "0001628280-26-008131", filed: "2026-02-13", is_synthetic: true } });
    // fact() intentionally uses the synthetic test retrieval; genuine provenance
    // is separately asserted directly on the unchanged downloaded fixture.
    const genuine = mapAnnual(fixture.companyfacts, fixture.metadata).facts.find(f => f.line_item === "prohibited_income")!;
    expect(genuine.source?.is_synthetic).toBe(false);
    expect(p.mapping_note).toContain("not a complete gross prohibited-income total");
    expect(p.mapping_note).toContain("2025-01-01 to 2025-12-31");
    for (const name of ["aapl", "msft"]) expect(fact(load(name).companyfacts, "prohibited_income").value).toBeNull();
  });
  it("does not assume zero, net interest or cross-period evidence", () => {
    const data = sample();
    add(data, "InvestmentIncomeInterestAndDividend", observation(99, { start: "2024-01-01", end: "2024-12-31" }));
    expect(fact(data, "prohibited_income").value).toBeNull();
    add(data, "InvestmentIncomeInterest", observation(10, { start: "2025-10-01", form: "10-Q" }));
    expect(fact(data, "prohibited_income").value).toBeNull();
    add(data, "InvestmentIncomeInterest", observation(10, { start: "2024-01-01", end: "2024-12-31" }));
    expect(fact(data, "prohibited_income").value).toBeNull();
    add(data, "InvestmentIncomeInterest", observation(10, { start: "2025-01-01" }), "EUR");
    expect(fact(data, "prohibited_income").value).toBeNull();
    add(data, "InvestmentIncomeInterest", observation(0, { start: "2025-01-01" }));
    expect(fact(data, "prohibited_income")).toMatchObject({ value: 0, input_state: "estimated" });
    const negative = sample();
    add(negative, "InvestmentIncomeInterest", observation(-1, { start: "2025-01-01" }));
    expect(fact(negative, "prohibited_income")).toMatchObject({ value: null, input_state: "unknown" });
  });
  const expected = {
    aapl: [416161000000, null, 359241000000, 73733000000, 98657000000, 1230000000, 12490000000,
      35934000000, 18763000000, 39777000000, 112010000000, 111482000000, 14594180000, 391035000000, 93736000000],
    msft: [331839000000, null, 758376000000, 442387000000, 40294000000, 66594000000, 21925000000,
      20935000000, 55908000000, 80876000000, 133749000000, 182935000000, 7425545491, 281724000000, 101832000000],
    jpm: [182447000000, 28032000000, 4424900000000, 362438000000, 64776000000, null, 9337000000,
      343338000000, null, null, 57048000000, -147782000000, 2658186195, 177556000000, 58471000000],
  };
  it.each(["aapl", "msft", "jpm"] as const)("%s locks every value, state, tier, mapping note and source", name => {
    const fixture = load(name);
    const before = JSON.stringify(fixture);
    const result = mapAnnual(fixture.companyfacts, fixture.metadata);
    expect(result.facts.map(f => f.value)).toEqual(expected[name]);
    expect(result).toMatchSnapshot();
    expect(JSON.stringify(fixture)).toBe(before); // pure, non-mutating
    expect(fixture.metadata.original_sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const f of result.facts) {
      expect(f.calculation_version).toBe(SEC_CALCULATION_VERSION);
      expect(f.mapping_note.length).toBeGreaterThan(0);
      if (f.value !== null) expect(f.source).toMatchObject({
        provider: "SEC EDGAR", source_type: "regulatory_filing",
        is_synthetic: false, is_demo: false, production_blocked: false,
        retrieved_at: fixture.metadata.retrieved_at,
      });
    }
  });
  it("missing synthetic fixture is unknown for every candidate, never assumed zero", () => {
    const fixture = load("missing");
    const result = mapAnnual(fixture.companyfacts, fixture.metadata);
    expect(result).toMatchSnapshot();
    expect(result.facts).toHaveLength(15);
    for (const f of result.facts) {
      expect(f).toMatchObject({ value: null, input_state: "unknown", confidence_tier: "Estimated" });
      expect(f.unknown_note).toMatch(/^No XBRL value among: /);
      if (f.source) expect(f.source.production_blocked).toBe(true);
    }
    expect(result.period.source.is_synthetic).toBe(true);
  });
  it("retains the non-standard JPM candidate without silently adopting it", () => {
    const f = load("jpm");
    expect(entries(f.companyfacts, "RevenuesNetOfInterestExpense").some(e => e.end === "2025-12-31")).toBe(true);
    expect(candidates.total_revenue).not.toContain("RevenuesNetOfInterestExpense");
    expect(fact(f.companyfacts, "total_revenue").mapping_note).toContain("Revenues = 182447000000");
  });
  it("AAPL latest DEI shares cite their own later quarter, not the annual filing", () => {
    const f = load("aapl");
    const result = mapAnnual(f.companyfacts, f.metadata);
    const shares = result.facts.find(v => v.line_item === "shares_outstanding")!;
    expect(shares.source?.document_reference).not.toBe(result.period.filing_reference);
    expect(shares).toMatchObject({ as_of_date: "2026-07-17", unit: "shares", currency: null });
    expect(shares.source).toMatchObject({ document_title: "10-Q 2026", reporting_period: "2026-06-27" });
  });
});

const sumCases = [
  ["interest_bearing_debt", "LongTermDebtCurrent", "LongTermDebtNoncurrent"],
  ["finance_lease_liabilities", "FinanceLeaseLiabilityCurrent", "FinanceLeaseLiabilityNoncurrent"],
  ["operating_lease_liabilities", "OperatingLeaseLiabilityCurrent", "OperatingLeaseLiabilityNoncurrent"],
] as const;
describe.each(sumCases)("%s present-component semantics", (line, current, noncurrent) => {
  it.each([
    [[], null], [[7], 7], [[undefined, 11], 11], [[7, 11], 18], [[0], 0], [[0, 0], 0],
  ] as [((number | undefined)[]), number | null][])("components %j map to %s", (values, total) => {
    const data = sample();
    if (values[0] !== undefined) add(data, current, observation(values[0]));
    if (values[1] !== undefined) add(data, noncurrent, observation(values[1]));
    const f = fact(data, line);
    expect(f).toMatchObject(total === null ?
      { value: null, input_state: "unknown", confidence_tier: "Estimated" } :
      { value: total, input_state: line === "interest_bearing_debt" && values[1] === undefined ? "estimated" : "derived",
        confidence_tier: line === "interest_bearing_debt" && values[1] === undefined ? "Estimated" : "Calculated" });
    const tags = candidates[line];
    expect(f.unknown_note).toBe(total === null ? `No XBRL value among: ${tags.join(", ")}` : null);
    for (const [i, tag] of [current, noncurrent].entries()) {
      expect(f.mapping_note).toContain(values[i] === undefined ? tag : `${tag} = ${values[i]} USD`);
    }
    if (total === null && line === "interest_bearing_debt")
      expect(f.mapping_note).toContain("Absent in selected filing: LongTermDebt,");
  });
  it.each(["EUR", "shares"])("a present %s component invalidates the entire sum", unit => {
    const data = sample();
    add(data, current, observation(7));
    add(data, noncurrent, observation(11), unit);
    const f = fact(data, line);
    expect(f.value).toBeNull();
    expect(f.input_state).toBe("unknown");
    expect(f.unknown_note).toContain(`Unusable present component: ${noncurrent}`);
    expect(f.mapping_note).toContain(`${current} = 7 USD`);
    expect(f.mapping_note).toContain(`11 ${unit}`);
    expect(f.unknown_note).not.toContain("No XBRL value");
  });
  it.each([
    { end: "2024-12-31" }, { start: "2025-01-01" }, { start: "2025-10-01" },
  ])("present incompatible period %j is not absence", period => {
    const data = sample();
    add(data, current, observation(7));
    add(data, noncurrent, observation(11, period));
    const f = fact(data, line);
    expect(f.value).toBeNull();
    expect(f.unknown_note).toContain("incompatible unit/period");
    expect(f.mapping_note).not.toContain(`Absent in selected filing: ${noncurrent}`);
  });
  it("an alternate unit does not displace a valid USD component", () => {
    const data = sample();
    add(data, current, observation(7), "EUR");
    add(data, current, observation(9));
    expect(fact(data, line).value).toBe(9);
  });
  it("never pools the other component from an unrelated accession", () => {
    const data = sample();
    add(data, current, observation(7));
    add(data, noncurrent, observation(500, { accn: "9999999999-25-000001", filed: "2025-01-01" }));
    const f = fact(data, line);
    expect(f.value).toBe(7);
    expect(f.mapping_note).toContain(noncurrent);
    expect(f.mapping_note).not.toContain("500");
  });
});
describe("debt alternatives and exclusions", () => {
  it.each(["ShortTermBorrowings", "CommercialPaper", "LongTermDebtCurrent"])("D-116 marks %s-only debt incomplete", tag => {
    const data = sample();
    add(data, tag, observation(7));
    expect(fact(data, "interest_bearing_debt")).toMatchObject({
      value: 7, input_state: "estimated", confidence_tier: "Estimated", unknown_note: null,
      mapping_note: expect.stringContaining("No long-term debt tag found; total may be incomplete — analyst to confirm"),
    });
  });
  it.each(["LongTermDebt", "LongTermDebtNoncurrent"])("zero %s is present, not incomplete", tag => {
    const data = sample();
    add(data, tag, observation(0));
    expect(fact(data, "interest_bearing_debt")).toMatchObject({
      value: 0, input_state: "derived", confidence_tier: "Calculated",
    });
    expect(fact(data, "interest_bearing_debt").mapping_note).not.toContain("total may be incomplete");
  });
  it("never adds lease-inclusive or maturity tags to debt candidates", () => {
    expect(candidates.interest_bearing_debt.some(t => /Lease|Maturit/.test(t))).toBe(false);
  });
  it("aggregate replaces the pair, with extra borrowings/paper but never leases", () => {
    const data = sample();
    for (const [tag, value] of [
      ["LongTermDebt", 100], ["LongTermDebtCurrent", 10], ["LongTermDebtNoncurrent", 90],
      ["ShortTermBorrowings", 5], ["CommercialPaper", 2], ["FinanceLeaseLiabilityCurrent", 500],
      ["OperatingLeaseLiabilityNoncurrent", 800],
    ] as const) add(data, tag, observation(value));
    const f = fact(data, "interest_bearing_debt");
    expect(f.value).toBe(105);
    expect(f.mapping_note).toContain("Alternative excluded: LongTermDebtNoncurrent, LongTermDebtCurrent");
    expect(f.mapping_note).toContain("lease liabilities excluded");
    expect(f.mapping_note).not.toContain("= 500");
    expect(f.mapping_note).not.toContain("= 800");
  });
  it("a present but unusable aggregate is unknown, not fallback to the pair", () => {
    const data = sample();
    add(data, "LongTermDebt", observation(100), "EUR");
    add(data, "LongTermDebtCurrent", observation(10));
    add(data, "LongTermDebtNoncurrent", observation(90));
    expect(fact(data, "interest_bearing_debt").unknown_note).toContain("LongTermDebt: incompatible");
    expect(fact(data, "interest_bearing_debt").value).toBeNull();
  });
  it("pair plus additional components and zero-valued aggregate are explicit", () => {
    const data = sample();
    add(data, "LongTermDebtCurrent", observation(10));
    add(data, "LongTermDebtNoncurrent", observation(90));
    add(data, "ShortTermBorrowings", observation(5));
    add(data, "CommercialPaper", observation(2));
    expect(fact(data, "interest_bearing_debt").value).toBe(105);
    add(data, "LongTermDebt", observation(0));
    expect(fact(data, "interest_bearing_debt").value).toBe(5);
  });
});

describe.each([
  ["finance_lease_liabilities", "FinanceLeaseLiability"],
  ["operating_lease_liabilities", "OperatingLeaseLiability"],
] as const)("D-117 %s preferred total", (line, tag) => {
  it.each([0, 123])("uses total %s without also adding the pair", value => {
    const data = sample();
    add(data, tag, observation(value));
    add(data, `${tag}Current`, observation(50));
    add(data, `${tag}Noncurrent`, observation(100));
    expect(fact(data, line)).toMatchObject({ value, input_state: "reported", confidence_tier: "Verified" });
    expect(fact(data, line).mapping_note).toContain(`Alternative excluded: ${tag}Current, ${tag}Noncurrent`);
  });
  it("does not hide an incompatible total behind its valid component pair", () => {
    const data = sample();
    add(data, tag, observation(123), "EUR");
    add(data, `${tag}Current`, observation(50));
    expect(fact(data, line)).toMatchObject({ value: null, input_state: "unknown" });
    expect(fact(data, line).unknown_note).toContain(`${tag}: incompatible`);
  });
});
describe("annual/amendment/comparative selection", () => {
  it("latest amendment wins; unchanged direct facts keep their own same-period filing", () => {
    const data = sample();
    add(data, "Revenues", observation(100, { start: "2025-01-01" }));
    add(data, "Assets", observation(70));
    add(data, "Revenues", observation(110, { start: "2025-01-01", form: "10-K/A",
      filed: "2026-03-01", accn: "9999999999-26-000002" }));
    const result = mapAnnual(data, provenance);
    expect(result.period).toMatchObject({ filing_reference: "9999999999-26-000002", reported_date: "2026-03-01" });
    expect(fact(data, "total_revenue").value).toBe(110);
    expect(fact(data, "total_assets")).toMatchObject({
      value: 70, source: { document_reference: accession, document_title: "10-K 2025" },
    });
  });
  it.each([
    ["2024-12-29", "2025-12-27"], // 52 weeks
    ["2024-12-29", "2026-01-03"], // 53 weeks
  ])("accepts a full 52/53-week year %s to %s", (start, end) => {
    const data = sample();
    data.facts["us-gaap"] = {};
    add(data, "Revenues", observation(123, { start, end }));
    expect(selectAnnual(data)).toMatchObject({ start, end });
    expect(fact(data, "total_revenue").value).toBe(123);
  });
  it("ignores a newer 10-Q and quarter/YTD durations labelled FY", () => {
    const data = sample();
    add(data, "Revenues", observation(100, { start: "2025-01-01" }));
    for (const start of ["2025-10-01", "2025-04-01"])
      add(data, "Revenues", observation(999, { start }));
    add(data, "Revenues", observation(999, { start: "2026-01-01", end: "2026-03-31", form: "10-Q", filed: "2026-05-01" }));
    expect(fact(data, "total_revenue").value).toBe(100);
    expect(selectAnnual(data).end).toBe("2025-12-31");
  });
  it("quarterly-only evidence cannot select a period", () => {
    const data = sample();
    data.facts["us-gaap"] = {};
    add(data, "Revenues", observation(1, { start: "2025-10-01" }));
    expect(() => selectAnnual(data)).toThrow("No usable annual");
  });
  it("uses actual prior dates despite comparative fy; latest prior filing has its own source", () => {
    const data = sample();
    add(data, "Revenues", observation(100, { start: "2025-01-01" }));
    add(data, "Revenues", observation(80, { start: "2024-01-01", end: "2024-12-31", fy: 2025 }));
    add(data, "NetIncomeLoss", observation(10, { start: "2024-01-01", end: "2024-12-31", fy: 2025 }));
    add(data, "Revenues", observation(81, { start: "2024-01-01", end: "2024-12-31", fy: 2024,
      accn: "9999999999-26-000003", form: "10-K/A", filed: "2026-04-01" }));
    expect(fact(data, "prior_year_revenue")).toMatchObject({
      value: 81, as_of_date: "2024-12-31", source: { document_reference: "9999999999-26-000003", document_title: "10-K/A 2024" },
    });
    expect(fact(data, "prior_year_net_income").value).toBe(10);
    expect(selectAnnual(data).fiscalYear).toBe(2025);
  });
  it("absent true prior observation stays unknown, not a two-year-old fallback", () => {
    const data = sample();
    add(data, "Revenues", observation(80, { start: "2023-01-01", end: "2023-12-31" }));
    expect(fact(data, "prior_year_revenue").value).toBeNull();
  });
  it("ties and alternate units are deterministic, regardless of input order", () => {
    const data = sample();
    add(data, "Revenues", observation(100, { start: "2025-01-01" }));
    add(data, "Assets", observation(70), "EUR");
    add(data, "Assets", observation(70));
    add(data, "Assets", observation(71));
    const first = mapAnnual(data, provenance);
    data.facts["us-gaap"].Assets.units.USD.reverse();
    expect(mapAnnual(data, provenance)).toEqual(first);
    expect(fact(data, "total_assets").value).toBe(70);
    add(data, "Revenues", observation(120, { start: "2025-01-01", accn: "9999999999-26-000009" }));
    expect(fact(data, "total_revenue").value).toBe(120);
  });
  it("unusable duration/instant cannot become stale known data", () => {
    const data = sample();
    add(data, "Assets", observation(70, { end: "2024-12-31" }));
    add(data, "NetIncomeLoss", observation(80, { start: "2025-10-01" }));
    expect(fact(data, "total_assets").unknown_note).toContain("No compatible USD");
    expect(fact(data, "net_income").value).toBeNull();
    expect(annual(observation(1, { start: "2025-02-30" }))).toBe(false);
  });
});
describe("ordered direct candidates and special states", () => {
  it.each([
    ["total_revenue", candidates.total_revenue, true],
    ["total_equity", candidates.total_equity, false],
    ["interest_bearing_investments", candidates.interest_bearing_investments, false],
  ] as const)("%s exercises every requested candidate in order", (line, tags, duration) => {
    for (let index = 0; index < tags.length; index++) {
      const data = sample();
      for (let i = index; i < tags.length; i++) add(data, tags[i], observation(i + 1, duration ? { start: "2025-01-01" } : {}));
      const f = fact(data, line);
      expect(f.value).toBe(index + 1);
      expect(f.mapping_note).toContain(`${tags[index]} = ${index + 1} USD`);
      expect(f.input_state).toBe(line === "interest_bearing_investments" ? "estimated" : "reported");
      expect(f.confidence_tier).toBe(line === "interest_bearing_investments" ? "Estimated" : "Verified");
    }
  });
  it("restricted cash is an estimated fallback, never preferred over plain cash", () => {
    const data = sample();
    add(data, candidates.cash_and_equivalents[1], observation(90));
    expect(fact(data, "cash_and_equivalents")).toMatchObject({ value: 90, input_state: "estimated", confidence_tier: "Estimated" });
    expect(fact(data, "cash_and_equivalents").mapping_note).toContain("restricted cash");
    add(data, candidates.cash_and_equivalents[0], observation(80));
    expect(fact(data, "cash_and_equivalents")).toMatchObject({ value: 80, input_state: "reported" });
  });
  it("latest DEI instant and actual filing beat fy, array order and alternate units", () => {
    const data = sample();
    add(data, candidates.shares_outstanding[0], observation(10), "shares");
    add(data, candidates.shares_outstanding[0], observation(20, { end: "2026-04-01", form: "10-Q",
      filed: "2026-05-01", accn: "9999999999-26-000010", fy: 2026 }), "shares");
    add(data, candidates.shares_outstanding[0], observation(999, { end: "2026-05-01" }), "USD");
    expect(fact(data, "shares_outstanding")).toMatchObject({ value: 20, as_of_date: "2026-04-01",
      source: { document_reference: "9999999999-26-000010", document_title: "10-Q 2026" } });
  });
  it("never maps EBITDA or market cap", () => {
    expect(mapAnnual(sample(), provenance).facts.map(f => f.line_item)).not.toContain("ebitda");
    expect(mapAnnual(sample(), provenance).facts.map(f => f.line_item)).not.toContain("market_cap");
  });
  it("strictly supports new mapping provenance and preserves historic verification", () => {
    const input = goldenInput("A", "pass");
    const historical = screen(input);
    expect(verify(historical.hashPayload, historical.immutableHash)).toBe(true);
    expect(() => validate({ ...input, calculationVersion: SEC_CALCULATION_VERSION })).not.toThrow();
    const mapped = screen({ ...input, calculationVersion: SEC_CALCULATION_VERSION });
    expect(mapped.status).toBe(historical.status);
    expect(mapped.immutableHash).not.toBe(historical.immutableHash);
    expect(verify(mapped.hashPayload, mapped.immutableHash)).toBe(true);
    expect(() => validate({ ...input, calculationVersion: "calc-unknown" })).toThrow();
  });
});
