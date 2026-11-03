import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import bs from "./fixtures/sec-fsn/balance-sheet.json";
import type { FsnArchive, TableRow } from "../src/ingest/sec/fsn/contracts";
import { readArchive } from "../src/ingest/sec/fsn/archive";
import { mapFsn } from "../src/ingest/sec/fsn/mapping";
import { assessBalanceSheet, balanceSheetFacts } from "../src/ingest/sec/fsn/balance-sheet";
import { mapAnnual } from "../src/ingest/sec/annual";
import { fsnCompany, fsnFixture, fsnResponse, fsnRetrieval, fsnTargets, fsnZip } from "./fsn-fixture";

const table = (rows: TableRow[]) => {
  const keys = Object.keys(rows[0]);
  return [keys.join("\t"), ...rows.map(row => keys.map(key => row[key]).join("\t"))].join("\n") + "\n";
};
async function archive() {
  return { ...await readArchive(fsnResponse(fsnZip({
    "sub.tsv": fsnFixture("sub.tsv"), "num.tsv": fsnFixture("num.tsv") + table(bs.num).split("\n").slice(1).join("\n"),
    "pre.tsv": table(bs.pre),
  })), fsnTargets, true), retrieval: fsnRetrieval };
}
function sheet(a: FsnArchive) {
  return assessBalanceSheet(fsnTargets[0], a, a.numbers.find(row => row.tag === "Revenues")!);
}
describe("D-154 accession-first rounded FSN matching", () => {
  it.each([["AAPL", 0, "2024-09-29", "2025-09-27", "20250930", "3.0"],
    ["PEP", 5, "2024-12-29", "2025-12-27", "20251231", "4.0"]] as const)(
    "%s accepts rounded SUB/NUM dates, retaining the actual fiscal end", async (_ticker, index, start, end, rounded, datp) => {
      const company = fsnCompany(index);
      const fact = company.facts["us-gaap"]!.Revenues!.units.USD[0];
      Object.assign(fact, { start, end });
      const target = { ...fsnTargets[index], mapped: mapAnnual(company, fsnRetrieval) };
      const a = await archive(), accn = target.mapped.period.filing_reference;
      a.submissions = a.submissions.map(row => row.adsh === accn ? { ...row, period: rounded } : row);
      a.numbers = a.numbers.map(row => row.adsh === accn && row.qtrs === "4"
        ? { ...row, ddate: rounded, datp, durp: "0.021918058" } : row);
      const result = mapFsn(target, a);
      expect(result.reason).toBeNull();
      expect(result.fact).toMatchObject({ as_of_date: end, input_state: "estimated", confidence_tier: "Estimated" });
      const mismatch = structuredClone(a);
      mismatch.numbers = mismatch.numbers.map(row => row.adsh === accn && row.tag !== "Revenues" ? { ...row, datp: "0" } : row);
      expect(mapFsn(target, mismatch).fact).toBeNull();
    });
  it.each(["MSFT", "TXN", "NFLX", "LLY"])("%s reports actual rejected revenue candidates", async ticker => {
    const target = fsnTargets.find(t => t.ticker === ticker)!, a = await archive();
    a.numbers = a.numbers.map(row => row.adsh === target.mapped.period.filing_reference && row.tag === "Revenues"
      ? { ...row, uom: "EUR", dimn: "1", value: "999999" } : row);
    const result = mapFsn(target, a);
    expect(result.reason).toContain("No unique NUM revenue anchor");
    expect(result.revenueAnchor).toMatchObject({ eligibleContexts: 0,
      candidates: [expect.objectContaining({ row: expect.objectContaining({ uom: "EUR", dimn: "1", value: "999999" }),
        rejectedBy: expect.arrayContaining(["not consolidated USD, zero dimensions, iprx=1", "value differs from companyfacts"]) })] });
  });
  it("accepts zero-dimensional hex hashes but refuses multiple eligible fiscal contexts", async () => {
    const a = await archive();
    a.numbers = a.numbers.map(row => ({ ...row, dimh: "0x00000000000000000000000000000000" }));
    expect(mapFsn(fsnTargets[0], a).fact).not.toBeNull();
    a.numbers.push({ ...a.numbers.find(row => row.tag === "Revenues")!, datp: "3" });
    expect(mapFsn(fsnTargets[0], a).revenueAnchor).toMatchObject({ eligibleContexts: 2, reason: "Multiple eligible NUM fiscal contexts" });
    expect(mapFsn(fsnTargets[0], a).fact).toBeNull();
  });
});
describe("D-154 balance-sheet completeness, not NUM absence", () => {
  it("reads same-filing instantaneous cash and securities without replacing income", async () => {
    const a = await archive(), result = sheet(a);
    expect(result.components.cash.value).toBe(100);
    expect(result.components.short_term.value).toBe(200);
    expect(result.components.long_term.value).toBe(300);
    expect(mapFsn(fsnTargets[0], a).fact?.value).toBe(12);
    expect(balanceSheetFacts(result).at(-1)?.value).toBe(0);
    expect(balanceSheetFacts(result, false).at(-1)?.value).toBe(1);
  });
  it("uses explicit PRE absence as zero, labelled not on balance sheet; cash remains required", async () => {
    const a = await archive();
    a.presentation = a.presentation!.filter(row => row.tag === "CashAndCashEquivalentsAtCarryingValue");
    const result = sheet(a);
    for (const name of ["short_term", "long_term"] as const)
      expect(result.components[name]).toMatchObject({ value: 0, state: "not_on_balance_sheet", label: "not on balance sheet" });
    a.presentation = a.presentation.map(row => ({ ...row, tag: "Assets", plabel: "Assets" }));
    expect(sheet(a).components.cash).toMatchObject({ value: null, state: "unknown" });
  });
  it.each(["missing", "custom", "unreadable", "negative", "dimensional", "other filing", "other context"])(
    "%s evidence cannot establish securities completeness", async mode => {
      const a = await archive();
      if (mode === "missing") a.presentation = undefined;
      else if (mode === "custom") a.presentation!.push({ ...bs.pre[1], tag: "IssuerInvestmentAssets", version: bs.pre[1].adsh });
      else a.numbers = a.numbers.map(row => row.tag !== "ShortTermInvestments" ? row : {
        ...row, ...(mode === "unreadable" ? { value: "" } : mode === "negative" ? { value: "-1" }
          : mode === "dimensional" ? { dimn: "1" } : mode === "other filing" ? { adsh: "OTHER" } : { datp: "8" }),
      });
      expect(sheet(a).components.short_term).toMatchObject({ value: null, state: "unknown" });
    });
  it("does not double count an aggregate and presented securities children", async () => {
    const a = await archive();
    a.presentation!.push({ ...bs.pre[1], tag: "AvailableForSaleSecuritiesDebtSecuritiesCurrent" });
    a.numbers.push({ ...bs.num[1], tag: "AvailableForSaleSecuritiesDebtSecuritiesCurrent", value: "50" });
    expect(sheet(a).components.short_term.value).toBe(200);
  });
  it("requires a complete PRE file in comparison mode; IS-only presentation proves no BS absence", async () => {
    await expect(readArchive(fsnResponse(fsnZip({ "sub.tsv": fsnFixture("sub.tsv"), "num.tsv": fsnFixture("num.tsv") })),
      fsnTargets, true)).rejects.toThrow("missing complete PRE");
    const a = await archive(); a.presentation = a.presentation!.map(row => ({ ...row, stmt: "IS" }));
    expect(sheet(a).components.short_term.state).toBe("unknown");
  });
});
