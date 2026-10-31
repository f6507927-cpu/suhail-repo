import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readArchive } from "../src/ingest/sec/fsn/archive";
import { archiveCatalog, selectArchive } from "../src/ingest/sec/fsn/catalog";
import { mapFsn, withFsn } from "../src/ingest/sec/fsn/mapping";
import { CUSTOM_TAG_ALLOWLIST, FSN_PROVIDER, FSN_VERSION } from "../src/ingest/sec/fsn/contracts";
import { retainCurrent } from "../src/ingest/sec/fsn/precedence";
import { runFsnDryRun } from "../src/ingest/sec/fsn/dry-run";
import { SecClient } from "../src/ingest/sec/client";
import { fsnCompany, fsnFixture, fsnResponse, fsnRetrieval, fsnTargets, fsnZip } from "./fsn-fixture";
import { candidates } from "../src/ingest/sec/mapping";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, symlink, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function archive(targets = fsnTargets) {
  return { ...await readArchive(fsnResponse(), targets), retrieval: fsnRetrieval };
}
describe("sec_fsn exact filing fallback", () => {
  it("streams only selected accessions and ignores TXT/PRE; NUM before SUB is supported", async () => {
    const a = await archive([fsnTargets[0]]);
    expect(a.submissions).toHaveLength(1);
    expect(a.numbers).toHaveLength(4);
    expect(a.numbers.every(row => row.adsh === fsnTargets[0].mapped.period.filing_reference)).toBe(true);
  });
  it("accepts txt table names, preserves split UTF-8, rejects malformed/missing/duplicate tables", async () => {
    const sub = fsnFixture("sub.tsv"), num = fsnFixture("num.tsv");
    expect((await readArchive(fsnResponse(fsnZip({ "sub.txt": sub, "num.txt": num })), fsnTargets)).submissions).toHaveLength(8);
    const invalid: Record<string, string>[] = [{ "num.tsv": num }, { "num.tsv": num, "sub.tsv": "wrong\nx\n" },
      { "num.tsv": num, "num.txt": num, "sub.tsv": sub },
      { "num.tsv": num + "malformed\n", "sub.tsv": sub }];
    for (const tables of invalid) {
      await expect(readArchive(fsnResponse(fsnZip(tables)), fsnTargets)).rejects.toThrow();
    }
  });
  it("selects filing months, falls back to available quarters and honors only explicit catalog overrides", () => {
    const catalog = archiveCatalog(fsnFixture("catalog.html"));
    expect(selectArchive(catalog, "2026-07-30").dataset).toBe("2026_07");
    expect(selectArchive(catalog, "2025-10-31").dataset).toBe("2025q4");
    expect(selectArchive(catalog, "2025-10-31", "2026_02").dataset).toBe("2026_02");
    expect(() => selectArchive(catalog, "2025-10-31", "../x")).toThrow();
    expect(() => selectArchive(catalog, "2025-10-31", "2026_09")).toThrow("unavailable");
  });
  it("uses every calc-.6 standard candidate, Verified filing source and Estimated fact with unchanged D-124 warnings", async () => {
    const a = await archive();
    for (const [i, target] of fsnTargets.entries()) {
      const result = mapFsn(target, a);
      expect(result.fact).toMatchObject({ adapter: "sec_fsn", value: 12 + i, calculation_version: FSN_VERSION,
        input_state: "estimated", confidence_tier: "Estimated",
        source: { provider: FSN_PROVIDER, confidence_tier: "Verified", document_reference: target.mapped.period.filing_reference,
          source_url: target.mapped.facts[0].source!.source_url, is_synthetic: true, production_blocked: true } });
      expect(result.fact?.mapping_note).toContain("D-124");
      expect(result.fact?.mapping_note).toContain("not a complete gross prohibited-income total");
    }
    expect(fsnTargets.slice(0, 4).map(t => mapFsn(t, a).tag)).toEqual(candidates.prohibited_income);
  });
  it("lists custom Interest/InvestmentIncome values only as suggestions and never fuzzy-maps them", async () => {
    const a = await archive(), target = fsnTargets[0];
    a.numbers = a.numbers.filter(row => !candidates.prohibited_income.includes(row.tag as typeof candidates.prohibited_income[number]));
    const r = mapFsn(target, a);
    expect(r.fact).toBeNull();
    expect(r.suggestions.map(row => [row.tag, row.value, row.reviewOnly])).toEqual([
      ["InterestIncomeCustom", 99, true], ["InvestmentIncomeCustom", 23, true],
    ]);
    expect(CUSTOM_TAG_ALLOWLIST).toEqual([]);
  });
  // A newly approved entry must have a matching committed NUM row and exercise
  // exact ticker+CIK identity. Empty is intentional until founder tag review.
  for (const entry of CUSTOM_TAG_ALLOWLIST) it(`reviewed custom mapping ${entry.ticker}:${entry.tag}`, async () => {
    expect(entry.reviewReference.trim()).not.toBe("");
    const target = fsnTargets.find(t => t.ticker === entry.ticker && Number(t.cik) === Number(entry.cik))!;
    expect(target).toBeDefined();
    const a = await archive([target]);
    a.numbers = a.numbers.filter(row => row.tag === entry.tag || row.tag === "Revenues");
    expect(mapFsn(target, a).tag).toBe(entry.tag);
    expect(mapFsn({ ...target, ticker: "WRONG" }, a).fact).toBeNull();
    expect(mapFsn({ ...target, cik: "1" }, a).fact).toBeNull();
  });
  it.each([
    ["uom", "EUR"], ["qtrs", "1"], ["dimn", "1"], ["dimh", "abcd"], ["coreg", "subsidiary"], ["iprx", "2"],
    ["ddate", "20240930"], ["datp", "0"], ["durp", "0.1"], ["adsh", "0000000001-26-000010"],
    ["version", "custom/2025"], ["value", ""], ["value", "-1"], ["value", "Infinity"],
  ])("refuses incompatible income %s=%s", async (field, value) => {
    const a = await archive();
    a.numbers = a.numbers.map(row => row.tag === candidates.prohibited_income[0] ? { ...row, [field]: value } : row);
    expect(mapFsn(fsnTargets[0], a).fact).toBeNull();
  });
  it("rejects a revenue accession mismatch, wrong fiscal metadata, ambiguous values or absent/mismatched revenue anchors", async () => {
    const target = structuredClone(fsnTargets[0]), a = await archive();
    target.mapped.facts[0].source!.document_reference = "0000000001-26-000010";
    expect(mapFsn(target, a).reason).toContain("accession");
    const badSub = structuredClone(a); badSub.submissions[0].period = "20250930";
    expect(mapFsn(fsnTargets[0], badSub).reason).toContain("fiscal period");
    const badValue = structuredClone(a);
    badValue.numbers.push({ ...badValue.numbers[1], value: "999" });
    expect(mapFsn(fsnTargets[0], badValue).reason).toContain("Ambiguous");
    a.numbers = a.numbers.map(row => row.tag === "Revenues" ? { ...row, value: "1001" } : row);
    expect(mapFsn(fsnTargets[0], a).reason).toContain("revenue anchor");
  });
  it("never overwrites companyfacts including zero; transaction precedence protects corrections and later missing reads", async () => {
    const a = await archive(), target = structuredClone(fsnTargets[0]);
    const income = target.mapped.facts.find(f => f.line_item === "prohibited_income")!;
    for (const value of [0, 5]) {
      income.value = value;
      expect(mapFsn(target, a).fact).toBeNull();
    }
    income.value = null;
    const result = mapFsn(target, a), fact = result.fact!;
    expect(withFsn(target, result).facts.find(f => f.line_item === "prohibited_income")?.value).toBe(12);
    expect(retainCurrent(fact, { value: 0, origin: "sec", protected_current: false })).toBe(true);
    expect(retainCurrent(fact, { value: null, origin: "override", protected_current: true })).toBe(true);
    expect(retainCurrent(fact, { value: 12, origin: "sec_fsn", protected_current: false })).toBe(false);
    expect(retainCurrent(income, { value: 12, origin: "sec_fsn", protected_current: false })).toBe(true);
  });
  it("dry-run handles all eight stocks, downloads only three distinct filing-date archives, and reports no inferred screening status", async () => {
    vi.stubEnv("SEC_USER_AGENT", "Synthetic SEC fixture tests test@example.invalid");
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input); requested.push(url);
      if (url.endsWith("company_tickers_exchange.json")) return Response.json({
        fields: ["ticker", "cik"], data: fsnTargets.map(t => [t.ticker, Number(t.cik)]),
      });
      if (url.includes("/companyfacts/")) return Response.json(fsnCompany(fsnTargets.findIndex(t => url.includes(t.cik.padStart(10, "0")))));
      if (url.endsWith(".zip")) return fsnResponse();
      return new Response(fsnFixture("catalog.html"));
    });
    const output: unknown[] = [];
    await runFsnDryRun(new SecClient({ fetcher }), fsnTargets.map(t => t.ticker), row => output.push(row));
    expect(output).toHaveLength(8);
    for (const row of output) expect(row).toMatchObject({ dryRun: true,
      fieldsFound: [expect.objectContaining({ factTier: "Estimated", sourceTier: "Verified" })],
      screeningImpact: expect.stringContaining("Skipped: database required") });
    expect(requested.filter(url => url.endsWith(".zip"))).toHaveLength(3);
    expect(requested.filter(url => url.endsWith(".zip")).sort()).toEqual([
      ...archiveCatalog(fsnFixture("catalog.html")).values(),
    ].sort());
    expect(requested.every(url => /^https:\/\/(?:www|data)\.sec\.gov\//.test(url))).toBe(true);
    // The CLI implementation has no transitive app DB import and no write API.
    const cli = (await import("node:fs")).readFileSync("src/ingest/sec/fsn/dry-run.ts", "utf8");
    expect(cli).not.toMatch(/dbApp|dbPublic|writeFile|persistAnnual/);
  });
  it("the actual dry-run CLI runs with DB credentials absent and writes no files (fixture HTTP only)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fsn-cli-"));
    try {
      for (const name of ["scripts", "src", "node_modules"]) await symlink(resolve(name), join(dir, name));
      await mkdir(join(dir, "data/launch"), { recursive: true });
      await writeFile(join(dir, "data/launch/universe.csv"), "ticker\n" + fsnTargets.map(t => t.ticker).join("\n") + "\n");
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (/DATABASE|^PG|SUPABASE|SESSION_SECRET|NODE_OPTIONS/.test(key)) delete env[key];
      env.SEC_USER_AGENT = "Offline fixture test test@example.invalid";
      // Do not recursively follow the dependency/source symlinks into the repo.
      const files = async () => ({ root: await readdir(dir), data: await readdir(join(dir, "data"), { recursive: true }) });
      const before = await files();
      const { stdout } = await promisify(execFile)(process.execPath, [
        "--conditions=react-server", "--import", resolve("tests/fixtures/sec-fsn/mock-http.mjs"),
        "--import", "tsx", "scripts/sec/fsn-dry-run.ts",
      ], { cwd: dir, env, timeout: 20_000 });
      expect((stdout.match(/"dryRun": true/g) ?? [])).toHaveLength(8);
      expect(stdout).toContain('"value": 12');
      expect(stdout).toContain("InterestIncomeCustom");
      expect(await files()).toEqual(before);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30_000);
});
