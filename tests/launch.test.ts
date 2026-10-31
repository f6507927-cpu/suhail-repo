import { describe, expect, it, vi } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import definitionFile from "../data/methodologies/al-rajhi-adapted-1.0.json";
import { launchInputs, launchDefinition, launchCases, csv, TICKERS, CLOSE_FIELDS } from "../src/lib/launch/contracts";
import { testReport } from "../src/lib/methodology/reports";
import { engineCriterion } from "../src/lib/methodology/contracts";
import { screen } from "../src/engine";
import { ENGINE_VERSION, CALCULATION_VERSION } from "../src/engine/versions";
import { activityCategory } from "../src/db/schema/core";
import { mapAnnual } from "../src/ingest/sec/annual";
import type { Fixture } from "../src/ingest/sec/types";
vi.mock("server-only", () => ({}));
const inputs = readFileSync("tests/fixtures/launch/inputs-blank.csv", "utf8");
const universe = readFileSync("data/launch/universe.csv", "utf8");
const filledInputs = readFileSync("tests/fixtures/launch/inputs-filled.csv", "utf8");
const definition = launchDefinition(definitionFile);
const ids = { primary_activity: "00000000-0000-4000-8000-000000000001", debt: "00000000-0000-4000-8000-000000000002", income: "00000000-0000-4000-8000-000000000003" };
const criteria = definition.criteria.map(c => engineCriterion({ ...c.data, id: ids[c.key] }));
const version = { id: "candidate", label: "Candidate", criteria };
const cases = launchCases(definition, ids);

describe("launch files and whole-file preflight", () => {
  it("fixtures contain the ordered 25 rows and differ only in synthetic closes", () => {
    const blankRows = csv(inputs);
    const filledRows = csv(filledInputs);
    expect(blankRows.slice(1).map(r => r[0])).toEqual(TICKERS);
    expect(filledRows).toEqual(blankRows.map((r, index) =>
      index === 0 ? r : [r[0], "10", "20", "30", ...r.slice(4)]));
    expect(csv(universe).slice(1).map(r => r[0])).toEqual(TICKERS);
  });
  it("rejects solely all 75 empty closes while accepting populated source/activity fields", () => {
    try { launchInputs(inputs, universe); throw new Error("accepted"); }
    catch (error) {
      const errors = (error as Error).message.split("\n");
      expect(errors).toHaveLength(75);
      expect(errors.every(e => CLOSE_FIELDS.some(field => e.includes(field)))).toBe(true);
    }
    expect(launchInputs(filledInputs, universe)).toHaveLength(25);
    expect(launchInputs(filledInputs, universe).every(r => r.prohibited_income === "")).toBe(true);
  });
  it("lists all bad fields, rejects duplicate/extra/missing tickers and validates optional evidence", () => {
    expect(() => launchInputs(filledInputs.replace("technology", "invented_category").replace(",10,20,30,", ",-1,20,30,"), universe))
      .toThrow(/close_2026_07_31[\s\S]*activity_category/);
    expect(() => launchInputs(filledInputs.replace("MSFT,", "AAPL,"), universe)).toThrow(/ticker/);
    expect(() => launchInputs(filledInputs, universe + "EXTRA\n")).toThrow(/universe/);
    expect(() => launchInputs(filledInputs.replace('services",,,', 'services",1,,'), universe)).toThrow(/prohibited_income_source/);
    expect(csv('a,b\n"one, two","quote ""x"""\n')).toEqual([["a", "b"], ["one, two", 'quote "x"']]);
    expect(() => csv('a\n"bad')).toThrow();
    expect(() => csv('a\n"x"bad')).toThrow();
  });
  it("actual pnpm CLI rejects the blank fixture with no database configuration", () => {
    const dir = mkdtempSync(join(tmpdir(), "suhail-launch-blank-cli-"));
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/DATABASE_URL|^PG|SUPABASE/.test(key)) delete env[key];
    try {
      mkdirSync(join(dir, "data/launch"), { recursive: true });
      mkdirSync(join(dir, "data/methodologies"), { recursive: true });
      writeFileSync(join(dir, "data/launch/inputs.csv"), inputs);
      writeFileSync(join(dir, "data/launch/universe.csv"), universe);
      writeFileSync(join(dir, "data/methodologies/al-rajhi-adapted-1.0.json"), JSON.stringify(definitionFile));
      for (const folder of ["scripts", "node_modules", "src"]) symlinkSync(resolve(folder), join(dir, folder));
      writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { "setup:launch": "node scripts/run-launch.mjs" } }));
      execFileSync("pnpm", ["setup:launch", "--", "--actor", "fixture@example.test", "--dry-run"], { cwd: dir, env, encoding: "utf8", stdio: "pipe" });
      throw new Error("unexpected acceptance");
    } catch (error) {
      const failure = error as { stderr: string; status: number };
      expect(failure.status).toBe(1);
      expect(failure.stderr.match(/row \d+\.close_/g)).toHaveLength(75);
      expect(failure.stderr).not.toContain("configuration");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 30000);
});

describe("unapproved reviewable candidate", () => {
  it("passes existing coverage without approval or fabricated source verification", () => {
    expect(testReport(version, cases).passed).toBe(true);
    expect(definition.metadata).toMatchObject({ official_or_inspired: "adapted", licensing_status: "public_document", verified_by: null, verification_date: null });
    expect(criteria.map(c => c.borderlineMargin)).toEqual([null, null, null]);
    expect(criteria.map(c => c.threshold)).toEqual([null, 30, 5]);
  });
  it.each(activityCategory.enumValues)("candidate category %s follows D-132, unclassified stays unknown", category => {
    const input = { ...cases[0].inputs, segments: [{ ...cases[0].inputs.segments[0], activityCategory: category }],
      methodologyVersion: version, engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION };
    const result = screen(input);
    const prohibited = criteria[0].treatmentRuleData.prohibited_categories as string[];
    expect(result.criteria[0].result).toBe(category === "unclassified" ? "unknown" : prohibited.includes(category) ? "fail" : "pass");
    expect(() => screen({ ...input, segments: [{ ...input.segments[0], activityCategory: "invalid_category" }] })).toThrow();
  });
});

describe("only explicit latest-cover-page share-class evidence", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/sec/aapl.json", "utf8")) as Fixture;
  function mapped(change: (rows: Fixture["companyfacts"]["facts"][string][string]["units"][string]) => void) {
    const copy = structuredClone(fixture);
    const concept = copy.companyfacts.facts.dei.EntityCommonStockSharesOutstanding;
    const latest = [...concept.units.shares].sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0];
    concept.units.shares = [latest]; change(concept.units.shares);
    const fact = mapAnnual(copy.companyfacts, copy.metadata).facts.find(f => f.line_item === "shares_outstanding")!;
    return { ...fact, shares_class_concern: fact.shares_class_concern ?? false };
  }
  it("accepts a single dei value, missing dimensions and historical/duplicate observations", () => {
    expect(mapped(() => {}).shares_class_concern).toBe(false);
    expect(mapped(rows => { rows.push({ ...rows[0] }); }).shares_class_concern).toBe(false);
    expect(mapped(rows => { rows.push({ ...rows[0], end: "2020-01-01", member: "ClassB" }); }).shares_class_concern).toBe(false);
    expect(mapped(rows => { rows[0].member = "ClassA"; rows.push({ ...rows[0], accn: "0000320193-20-000001", member: "ClassB" }); }).shares_class_concern).toBe(false);
  });
  it("flags multiple classes/members and explicit aggregation only", () => {
    expect(mapped(rows => { rows[0].share_class = "A"; rows.push({ ...rows[0], share_class: "B" }); }).shares_class_concern).toBe(true);
    expect(mapped(rows => { rows[0].member = "A"; rows.push({ ...rows[0], member: "B" }); }).shares_class_concern).toBe(true);
    expect(mapped(rows => { rows[0].explicitly_aggregated = true; }).shares_class_concern).toBe(true);
    expect(mapped(rows => { rows[0].dimensions = { "us-gaap:StatementClassOfStockAxis": "A" }; }).shares_class_concern).toBe(false);
  });
});
