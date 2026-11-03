import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import bs from "./fixtures/sec-fsn/balance-sheet.json";
import cases from "./fixtures/sec-fsn/bound-tag-extensions.json";
import { fsnRetrieval, fsnTargets } from "./fsn-fixture";
import type { FsnArchive, TableRow } from "../src/ingest/sec/fsn/contracts";
import { assessBalanceSheet } from "../src/ingest/sec/fsn/balance-sheet";
import { CASH_SHORT_SUBTOTAL, CUSTOM_BOUND_TAG_ALLOWLIST, EXCLUDED_EQUITY_METHOD } from "../src/ingest/sec/fsn/bound-tag-policy";
import { upperBoundSummary } from "../src/ingest/sec/fsn/summary";
import { storedBalanceFacts, BOUND_CONTEXT, boundContextSchema, BOUND_VERSION } from "../src/ingest/sec/fsn/stored-bound";

function fixture() {
  const pre: TableRow[] = structuredClone(bs.pre);
  pre.push({ ...pre[0], tag: "AssetsCurrent", line: "25", plabel: "Total current assets" });
  const numbers: TableRow[] = structuredClone(bs.num);
  const anchor: TableRow = { ...numbers[0], tag: "Revenues", value: "1000", qtrs: "4", durp: "-11.97" };
  const target = structuredClone(fsnTargets[0]);
  const archive: FsnArchive = { submissions: [{ adsh: pre[0].adsh, cik: target.cik, sic: "" }],
    numbers: [anchor, ...numbers], presentation: pre, retrieval: fsnRetrieval };
  return { archive, target, anchor };
}
type Fixture = ReturnType<typeof fixture>;
function add(f: Fixture, tag: string, value = "25", line = "15", version = "us-gaap/2025") {
  f.archive.presentation!.push({ ...bs.pre[0], adsh: f.target.mapped.period.filing_reference,
    tag, version, line, plabel: tag });
  f.archive.numbers.push({ ...bs.num[0], adsh: f.target.mapped.period.filing_reference, tag, version, value });
}
const assess = (f: Fixture) => assessBalanceSheet(f.target, f.archive, f.anchor);

describe("D-155 reviewed bound tags (synthetic fixtures only)", () => {
  it.each(cases)("$tag is selected in its approved bucket", c => {
    const f = fixture();
    if (c.mode === "replace") {
      const old = c.bucket === "short_term" ? "ShortTermInvestments" : "LongTermInvestments";
      for (const row of [...f.archive.presentation!, ...f.archive.numbers]) if (row.tag === old) row.tag = c.tag;
    } else add(f, c.tag, c.mode === "total" ? "125" : "25", c.tag.endsWith("Noncurrent") ? "40" : "15");
    const result = assess(f);
    expect(result.blockers).toEqual([]);
    expect(result.components[c.bucket as keyof typeof result.components].value).toBe(c.expected);
  });
  it("the combined restricted total replaces cash and restricted components, including unreadable children", () => {
    const f = fixture();
    add(f, "RestrictedCashCurrent", "bad");
    add(f, "RestrictedCashNoncurrent", "80", "40");
    add(f, "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "250");
    expect(assess(f).components.cash.value).toBe(250);
  });
  it("both restricted components add to cash when no encompassing total exists", () => {
    const f = fixture(); add(f, "RestrictedCashCurrent", "25"); add(f, "RestrictedCashNoncurrent", "75", "40");
    expect(assess(f).components.cash.value).toBe(200);
  });
  it("cash/short-term subtotal replaces both groups, without reading or adding their components", () => {
    const f = fixture(); add(f, CASH_SHORT_SUBTOTAL, "350", "21");
    f.archive.numbers.find(row => row.tag === "CashAndCashEquivalentsAtCarryingValue")!.value = "unreadable";
    f.archive.numbers.find(row => row.tag === "ShortTermInvestments")!.value = "999";
    const result = assess(f);
    expect(result.components.cash).toMatchObject({ value: 350, tags: [CASH_SHORT_SUBTOTAL] });
    expect(result.components.short_term).toMatchObject({ value: 0, state: "included_in_subtotal" });
    const stored = storedBalanceFacts(f.target, result).find(row => row.line_item === BOUND_CONTEXT)!;
    expect(stored.value).toBe(1);
    expect(boundContextSchema.safeParse(JSON.parse(stored.value_text!)).success).toBe(true);
    expect(stored.calculation_version).toBe(BOUND_VERSION);
    const text = upperBoundSummary({ ticker: "MSFT", balanceSheet: result });
    expect(text).toContain("cash=350 [cash + short-term subtotal]");
    expect(text).toContain("short-term=0 [included in cash + short-term subtotal]");
  });
  it("does not silently drop separately presented restricted cash around the cash/short-term subtotal", () => {
    const f = fixture(); add(f, CASH_SHORT_SUBTOTAL, "350", "21"); add(f, "RestrictedCashNoncurrent", "75", "40");
    expect(assess(f).components.cash.reason).toContain("overlap is unproven");
  });
  it("a cash/short-term custom lookalike is not an approved subtotal", () => {
    const f = fixture(); add(f, CASH_SHORT_SUBTOTAL, "350", "21", f.anchor.adsh);
    expect(assess(f).blockers.map(row => row.tag)).toContain(CASH_SHORT_SUBTOTAL);
  });
  it.each(["MarketableSecurities", "MarketableSecuritiesAndEquitySecuritiesFVNI"])("%s cannot be selected outside current assets", tag => {
    const f = fixture(); add(f, tag, "50", "40");
    expect(assess(f).blockers.map(row => row.tag)).toContain(tag);
  });
  it("a generic tag without an AssetsCurrent boundary does not establish maturity", () => {
    const f = fixture(); add(f, "MarketableSecurities");
    f.archive.presentation = f.archive.presentation!.filter(row => row.tag !== "AssetsCurrent");
    expect(assess(f).blockers.map(row => row.tag)).toContain("MarketableSecurities");
  });
  it("CAL can prove current membership; conflicting PRE/CAL cannot", () => {
    const f = fixture();
    for (const row of [...f.archive.numbers, ...f.archive.presentation!]) if (row.tag === "ShortTermInvestments") row.tag = "MarketableSecurities";
    f.archive.presentation = f.archive.presentation!.filter(row => row.tag !== "AssetsCurrent");
    f.archive.calculations = [{ adsh: f.anchor.adsh, grp: "BS", ptag: "AssetsCurrent",
      pversion: "us-gaap/2025", ctag: "MarketableSecurities", cversion: "us-gaap/2025" }];
    expect(assess(f).components.short_term.value).toBe(200);
    add(f, "AssetsCurrent", "800", "15");
    expect(assess(f).blockers.map(row => row.tag)).toContain("MarketableSecurities");
  });
  it("equity-method investments are neither counted nor blockers and are explicitly labelled", () => {
    const f = fixture(); add(f, EXCLUDED_EQUITY_METHOD, "99999", "40");
    const result = assess(f);
    expect(result.blockers).toEqual([]);
    expect(result.components.long_term.value).toBe(300);
    expect(upperBoundSummary({ ticker: "INTC", balanceSheet: result })).toContain("excluded: equity-method investment");
    expect(storedBalanceFacts(f.target, result).find(row => row.line_item === BOUND_CONTEXT)!.value_text)
      .toContain("excluded: equity-method investment");
  });
  it("an unreviewed custom equity-method lookalike still blocks completeness", () => {
    const f = fixture(); add(f, EXCLUDED_EQUITY_METHOD, "99999", "40", f.anchor.adsh);
    expect(assess(f).blockers.map(row => row.tag)).toContain(EXCLUDED_EQUITY_METHOD);
  });
  it.each(CUSTOM_BOUND_TAG_ALLOWLIST)("only the reviewed $ticker + $cik + $tag custom entry is eligible", entry => {
    const f = fixture(), adsh = "0000050863-26-000011";
    f.target.ticker = entry.ticker; f.target.cik = entry.cik;
    f.target.mapped.period.filing_reference = adsh;
    for (const row of [...f.archive.numbers, ...f.archive.presentation!, ...f.archive.submissions]) row.adsh = adsh;
    for (const row of [...f.archive.numbers, ...f.archive.presentation!]) if (row.tag === "LongTermInvestments") {
      row.tag = entry.tag; row.version = adsh;
    }
    f.archive.submissions[0].cik = entry.cik;
    expect(assess(f).components.long_term.value).toBe(300);
    f.target.ticker = "OTHER";
    expect(assess(f).blockers.map(row => row.tag)).toContain(entry.tag);
    f.target.ticker = entry.ticker; f.target.cik = "0000000001";
    expect(assess(f).blockers.map(row => row.tag)).toContain(entry.tag);
    f.target.cik = entry.cik;
    for (const row of f.archive.presentation!) if (row.tag === entry.tag) row.version = "other-company/2025";
    expect(assess(f).blockers.map(row => row.tag)).toContain(entry.tag);
  });
  it.each(["6000", "6100", "6299"])("SIC %s skips the bound even without a presentation", sic => {
    const f = fixture(); f.archive.submissions[0].sic = sic; f.archive.presentation = [];
    const result = assess(f);
    expect(result.components.cash.reason).toBe("not applicable: financial institution");
    expect(result.components.cash.value).toBeNull();
    expect(storedBalanceFacts(f.target, result).find(row => row.line_item === BOUND_CONTEXT)!.value).toBe(0);
  });
  it.each(["5999", "6300"])("SIC %s is outside the financial-institution exclusion", sic => {
    const f = fixture(); f.archive.submissions[0].sic = sic;
    expect(assess(f).components.cash.value).toBe(100);
  });
  it("WMT-style unreadable cash prints NUM values, contexts, dimensions and iprx candidates, not just PRE lines", () => {
    const f = fixture(), cash = f.archive.numbers.find(row => row.tag === "CashAndCashEquivalentsAtCarryingValue")!;
    f.archive.numbers.push({ ...cash, value: "101", iprx: "0" }, { ...cash, dimn: "1", dimh: "0x1234", iprx: "2" },
      { ...cash, datp: "99", iprx: "3" });
    const result = assess(f);
    expect(result.components.cash.value).toBeNull();
    expect(result.components.cash.rows).toHaveLength(4);
    const summary = upperBoundSummary({ ticker: "WMT", balanceSheet: result });
    expect(summary).toContain('"value":"101"');
    expect(summary).toContain('"iprx":"0"');
    expect(summary).toContain("not consolidated zero-dimensional USD");
    expect(summary).toContain("different fiscal context (datp)");
    expect(summary).toContain("conflicting values or fiscal contexts");
    expect(summary).not.toContain("\n");
  });
});
