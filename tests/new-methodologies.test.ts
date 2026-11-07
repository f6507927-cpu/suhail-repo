import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { newMethodologyCases, newMethodologyDefinition, plannedIds } from "../src/lib/methodology/new-methodologies";
import { engineCriterion } from "../src/lib/methodology/contracts";
import { testReport } from "../src/lib/methodology/reports";
import { screen, ENGINE_VERSION, CALCULATION_VERSION } from "../src/engine";
import { SIC_AMBIGUOUS, SIC_PROHIBITED, sicActivity } from "../src/lib/financial/sic-activity";
import { documentReference } from "../src/lib/methodology/install-new";

const keys = ["aaoifi", "msci"] as const;
describe.each(keys)("%s adapted research definition", key => {
  const definition = newMethodologyDefinition(key);
  const ids = plannedIds(definition);
  const version = { id: "planned", label: "planned", criteria: definition.criteria.map(c => engineCriterion({ ...c.data, id: ids[c.key] })) };
  const cases = newMethodologyCases(definition, ids);

  it("follows the public naming pattern and never claims compliance or endorsement", () => {
    expect(definition.metadata.name).toMatch(/^Research implementation based on publicly documented criteria from /);
    expect(definition.metadata.official_or_inspired).toBe("adapted");
    expect(definition.metadata.licensing_status).toBe("unlicensed_adapted");
    expect(definition.metadata.verified_by).toBeNull();
    expect(definition.version.is_public).toBe(false);
    expect(definition.metadata.scope).toMatch(/Not affiliated with, endorsed by or licensed by/);
    const text = JSON.stringify(definition);
    expect(text).not.toMatch(/\b(is|are) (Shariah|Sharia|AAOIFI|MSCI)[- ]compliant\b|certified|approved by (AAOIFI|MSCI)/i);
  });
  it("records the document link, edition, retrieval date and SHA-256 only", () => {
    expect(definition.document.url).toMatch(/^https:\/\//);
    expect(definition.document.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(documentReference(definition.document)).toContain(definition.document.sha256);
    expect(documentReference(definition.document)).toContain(definition.document.edition);
  });
  it("gives every criterion a source locator and lists what is not applied", () => {
    for (const c of definition.criteria) expect(c.data.source_reference).toMatch(key === "aaoifi" ? /AAOIFI SS 21, clause/ : /MSCI .*§2\.[12]/);
    expect(definition.notApplied.length).toBeGreaterThan(3);
    expect(definition.reviewerQuestions.length).toBeGreaterThan(3);
    expect(definition.metadata.scope).toContain("Not applied:");
    expect(definition.metadata.scope?.toLowerCase()).toContain("purification");
  });
  it("analyst cases pass the normal test report with pass and fail coverage", () => {
    const report = testReport(version, cases);
    expect(report.analystCases.filter(c => !c.passed)).toEqual([]);
    expect(report.coverageGaps).toEqual([]);
    expect(report.passed).toBe(true);
  });
  it("covers pass, fail and unknown for every criterion", () => {
    for (const c of version.criteria) {
      const outcomes = new Set(cases.map(t => t.expected.criteria[c.id]));
      expect([...outcomes].sort(), c.label).toEqual(["fail", "pass", "unknown"]);
    }
  });
  it("passes exactly at every maximum threshold (source wording: must not exceed)", () => {
    for (const c of definition.criteria.filter(c => c.data.threshold_direction === "max")) {
      const atLimit = cases.filter(t => t.name.includes("exactly at") && t.expected.criteria[ids[c.key]] === "pass");
      expect(atLimit.length, c.key).toBeGreaterThan(0);
      for (const t of atLimit) {
        const result = screen({ ...t.inputs, methodologyVersion: version, engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION });
        expect(result.criteria.find(r => r.criterionId === ids[c.key])?.result).toBe("pass");
      }
    }
  });
});

describe("shared evidence stays methodology-neutral (D-173)", () => {
  it("the SIC table never assigns music, hotels or cinema; ambiguous codes stay unclassified", () => {
    const assigned = Object.keys(SIC_PROHIBITED);
    for (const category of ["music", "hotels", "cinema"]) expect(assigned).not.toContain(category);
    for (const code of [7011, 7812, 7819, 7822, 7829, 7830, 7841, 4832, 4833, 4841, 2711, 7990, 7993])
      expect(sicActivity(code, "src")?.activityCategory, String(code)).toBe("unclassified");
    expect(SIC_AMBIGUOUS).toContain(7011);
  });
  it("MSCI uses the December 2025 existing-constituent thresholds", () => {
    const msci = newMethodologyDefinition("msci");
    const threshold = (k: string) => msci.criteria.find(c => c.key === k)!.data.threshold;
    expect([threshold("revenue"), threshold("debt"), threshold("cash"), threshold("receivables")]).toEqual([5, 33.33, 33.33, 70]);
    expect(msci.criteria.find(c => c.key === "debt")!.data.numerator_line_items).toEqual(["interest_bearing_debt", "finance_lease_liabilities"]);
    expect(msci.criteria.find(c => c.key === "revenue")!.data.treatment_rule_data?.non_permissible_categories).not.toContain("conventional_media");
  });
  it("AAOIFI uses plain market capitalisation, not the Al Rajhi market value basis", () => {
    const aaoifi = newMethodologyDefinition("aaoifi");
    for (const k of ["debt", "deposits"]) expect(aaoifi.criteria.find(c => c.key === k)!.data.denominator_line_items).toEqual(["market_cap"]);
  });
});
