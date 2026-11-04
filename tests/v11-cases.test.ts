import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import base from "../data/methodologies/al-rajhi-adapted-1.0.json";
import { launchCases, launchDefinition } from "../src/lib/launch/contracts";
import { analystCasesSchema, criterionSchema, engineCriterion } from "../src/lib/methodology/contracts";
import { proposedV11Definition } from "../src/lib/methodology/proposed-v1.1";
import { missingV11Cases, v11Cases } from "../src/lib/methodology/v11-cases";
import { testReport } from "../src/lib/methodology/reports";
import { screen, ENGINE_VERSION, CALCULATION_VERSION } from "../src/engine";

const definition = launchDefinition(base);
const oldCriteria = definition.criteria.map((c, i) => ({ ...c.data, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
const oldCases = launchCases(definition, Object.fromEntries(definition.criteria.map((c, i) => [c.key, oldCriteria[i].id])));
const criteria = proposedV11Definition().criteria.map(({ key: _key, ...c }, i) => {
  void _key;
  return { ...criterionSchema.parse(c), id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, "0")}` };
});
const version = { id: "v11-fixture", label: "Synthetic v1.1", criteria: criteria.map(engineCriterion) };
const candidates = v11Cases(oldCases, oldCriteria, criteria);
const run = (name: string) => {
  const test = candidates.find(c => c.name === `Suhail v1.1: ${name}`)!;
  return screen({ ...test.inputs, methodologyVersion: version, engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION });
};

describe("v1.1 analyst-case fixtures", () => {
  it("copies every v1.0 case unchanged except matching criterion IDs, without mutating v1.0", () => {
    const before = structuredClone(oldCases);
    candidates.slice(0, oldCases.length).forEach((c, i) => {
      expect(c.inputs).toEqual(oldCases[i].inputs);
      expect(c.name).toBe(oldCases[i].name);
      expect(c.expected.status).toBe(oldCases[i].expected.status);
      expect(Object.values(c.expected.criteria)).toEqual(Object.values(oldCases[i].expected.criteria));
      expect(Object.keys(c.expected.criteria)).toEqual(criteria.map(c => c.id));
    });
    expect(oldCases).toEqual(before);
    expect(analystCasesSchema.parse(candidates)).toEqual(candidates);
  });
  it("all saved expectations and mandatory criterion pass/fail coverage pass the real report", () => {
    const report = testReport(version, candidates);
    expect(report.analystCases.filter(c => !c.passed)).toEqual([]);
    expect(report.coverageGaps).toEqual([]);
    expect(report.passed).toBe(true);
  });
  it.each(["upper bound below 5%", "upper bound exactly 5%"])("asserts Estimated upper-bound evidence: %s", name => {
    const income = run(name).criteria.find(c => c.criterionId === criteria[2].id)!;
    expect(income).toMatchObject({ result: "pass", confidenceTier: "Estimated", inputStates: expect.arrayContaining(["estimated"]) });
    expect(income.calculationTrace).toContain("upper bound=");
  });
  it("reported and analyst-resolved income wins, including zero; protected unknown blocks fallback", () => {
    for (const name of ["reported income wins over favorable bound", "analyst override wins over favorable bound"]) {
      expect(run(name).criteria[2]).toMatchObject({ result: "fail", numeratorValue: 12 });
    }
    expect(run("analyst zero override wins over excessive bound").criteria[2]).toMatchObject({ result: "pass", numeratorValue: 0 });
    expect(run("protected analyst unknown refuses bound").criteria[2]).toMatchObject({ result: "unknown", numeratorValue: null });
  });
  it("adds only missing cases, preserving owner edits and deduplicating repeated candidates", () => {
    const existing = structuredClone(candidates.slice(0, 2));
    existing[0].inputs.securityId = "owner-edited";
    const before = structuredClone(existing);
    const merged = missingV11Cases(existing, [...candidates, ...candidates]);
    expect(merged.cases.slice(0, 2)).toEqual(before);
    expect(existing).toEqual(before);
    expect(merged.added).toBe(candidates.length - 2);
    expect(missingV11Cases(merged.cases, candidates).added).toBe(0);
    const renamed = { ...candidates[0], name: "Owner renamed case" };
    expect(missingV11Cases([renamed], [candidates[0]]).added).toBe(0);
  });
  it("refuses unmatched or ambiguous old criterion references", () => {
    expect(() => v11Cases(oldCases, oldCriteria, criteria.slice(1))).toThrow("uniquely match");
    expect(() => v11Cases(oldCases, oldCriteria, [...criteria, criteria[0]])).toThrow("uniquely match");
    const invalid = structuredClone(oldCases);
    invalid[0].expected.criteria["00000000-0000-4000-8000-000000000099"] = "pass";
    expect(() => v11Cases(invalid, oldCriteria, criteria)).toThrow("unmatched criterion");
  });
});
