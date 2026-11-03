import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { screen, verify } from "../src/engine";
import { fact, input } from "../src/engine/__fixtures__/synthetic";
import { calculateUpperBound, upperBoundPolicySchema } from "../src/engine/upper-bound";
import { proposedV11Definition, proposedV11IncomeCriterion } from "../src/lib/methodology/proposed-v1.1";
import { criterionSchema, versionSchema } from "../src/lib/methodology/contracts";
import base from "../data/methodologies/al-rajhi-adapted-1.0.json";

const criterion = proposedV11IncomeCriterion();
const policy = upperBoundPolicySchema.parse(criterion.treatmentRuleData.suhail_upper_bound);
function proxy(cash = 100, revenue = 1000) {
  return input({ methodologyVersion: { id: "draft-v1.1", label: "1.1 draft", criteria: [structuredClone(criterion)] },
    facts: [fact("prohibited_income", null, "unknown"), fact("total_revenue", revenue),
      fact(policy.cash_line_item, cash), fact(policy.short_term_line_item, 0, "estimated"),
      fact(policy.long_term_line_item, 0, "estimated"), fact(policy.eligibility_line_item, 1)] });
}
describe("D-154 opt-in draft upper-bound rule", () => {
  it("passes a complete bound as Estimated and records the Suhail assumption in public calculation evidence", () => {
    const result = screen(proxy());
    expect(result.criteria[0]).toMatchObject({ result: "pass", numeratorValue: 6, ratio: 0.6, confidenceTier: "Estimated",
      inputStates: expect.arrayContaining(["estimated"]), sourceIds: expect.arrayContaining([`fixture-source-${policy.cash_line_item}`]) });
    expect(result.dataAdequacy).toBe("adequate_with_estimates");
    expect(result.criteria[0].calculationTrace).toContain("Annual yield assumption=6%");
    expect(result.criteria[0].calculationTrace).toContain("conservative assumption chosen by Suhail, not part of the Al Rajhi document");
    expect(verify(result.hashPayload, result.immutableHash)).toBe(true);
  });
  it("passes exactly 5%, but an excessive bound is unknown, never fail or borderline", () => {
    expect(screen(proxy(100, 120)).criteria[0].result).toBe("pass");
    const excessive = screen(proxy(100, 119.999999));
    expect(excessive.criteria[0]).toMatchObject({ result: "unknown", numeratorValue: 6 });
    expect(excessive.status).toBe("requires_review");
  });
  it.each([0, 60])("existing income %s always wins over a favorable bound", value => {
    const i = proxy(); i.facts[0] = fact("prohibited_income", value);
    expect(screen(i).criteria[0]).toMatchObject({ numeratorValue: value, result: value === 0 ? "pass" : "fail" });
    expect(screen(i).criteria[0].calculationTrace).not.toContain("Upper bound:");
  });
  it("respects protected unknown decisions and refuses unverified eligibility", () => {
    const i = proxy(); i.facts.find(f => f.lineItem === policy.eligibility_line_item)!.value = 0;
    expect(screen(i).criteria[0]).toMatchObject({ numeratorValue: null, result: "unknown" });
    i.facts = i.facts.filter(f => f.lineItem !== policy.eligibility_line_item);
    expect(screen(i).criteria[0].result).toBe("unknown");
  });
  it.each([policy.cash_line_item, policy.short_term_line_item, policy.long_term_line_item])(
    "missing/unreadable %s is unknown, not an invented zero", key => {
      const i = proxy(); i.facts = i.facts.filter(f => f.lineItem !== key);
      expect(screen(i).criteria[0].result).toBe("unknown");
    });
  it("uses the named configuration rate and hashes it without changing v1.0", () => {
    const i = proxy(), original = screen(i);
    (i.methodologyVersion.criteria[0].treatmentRuleData.suhail_upper_bound as Record<string, unknown>).annual_yield_assumption = 0.12;
    expect(screen(i).criteria[0].numeratorValue).toBe(12);
    expect(screen(i).immutableHash).not.toBe(original.immutableHash);
    i.methodologyVersion.criteria[0].treatmentRuleData = {};
    expect(screen(i).criteria[0].result).toBe("unknown");
    expect(base.version.version).toBe("1.0");
    expect(base.criteria.find(c => c.key === "income")!.treatment_rule_data).toBeNull();
  });
  it("prepares a normal unpublished version/criterion definition, never workflow approval", () => {
    const definition = proposedV11Definition();
    expect(versionSchema.parse(definition.version)).toMatchObject({ version: "1.1", is_public: false });
    expect(definition.criteria.slice(0, 2)).toEqual(base.criteria.slice(0, 2));
    for (const row of definition.criteria) {
      const { key, ...data } = row; void key;
      expect(criterionSchema.safeParse(data).success).toBe(true);
    }
    expect(definition.version).not.toHaveProperty("production_enabled");
    expect(definition.version).not.toHaveProperty("approved_by");
  });
  it("rejects missing/invalid named rates and unusable asset/revenue inputs", () => {
    const historical = proxy(); historical.engineVersion = "engine-1.0.1";
    expect(() => screen(historical)).toThrow("invalid opt-in");
    const i = proxy();
    delete (i.methodologyVersion.criteria[0].treatmentRuleData.suhail_upper_bound as Record<string, unknown>).annual_yield_assumption;
    expect(() => screen(i)).toThrow("invalid opt-in");
    expect(calculateUpperBound(policy, [null, 1, 1], 100, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [1, 1, 1], 0, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [-1, 1, 1], 100, 5).bound).toBeNull();
  });
  it("retains adjacent threshold inputs and the policy in the immutable payload", () => {
    const at = proxy(100, 120), over = proxy(100, 119.999999);
    expect(screen(at).immutableHash).not.toBe(screen(over).immutableHash);
    expect(screen(JSON.parse(JSON.stringify(over))).immutableHash).toBe(screen(over).immutableHash);
  });
  it.each([
    { criterionType: "interest_bearing_debt" }, { thresholdDirection: "min" },
    { numeratorLineItems: ["total_assets"] }, { denominatorLineItems: ["total_assets"] },
    { thresholdUnit: "percent_of_total_assets" }, { threshold: null }, { threshold: 0 },
  ])("rejects a mismatched upper-bound criterion configuration: %j", patch => {
    const i = proxy(); Object.assign(i.methodologyVersion.criteria[0], patch);
    expect(() => screen(i)).toThrow("invalid opt-in");
  });
  it("reports unknown for missing revenue, negative assets, overflows and underflows; zero assets are valid", () => {
    const i = proxy(); i.facts = i.facts.filter(f => f.lineItem !== "total_revenue");
    expect(screen(i).criteria[0].result).toBe("unknown");
    expect(calculateUpperBound(policy, [], 100, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [NaN, 0, 0], 100, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [1, 0, 0], null, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [1, 0, 0], NaN, 5).bound).toBeNull();
    expect(calculateUpperBound({ ...policy, annual_yield_assumption: 1 }, [1e308, 1e308, 1e308], 100, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [1, 0, 0], Number.MIN_VALUE, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [Number.MIN_VALUE, 0, 0], 100, 5).bound).toBeNull();
    expect(calculateUpperBound(policy, [0, 0, 0], 100, 5)).toMatchObject({ bound: 0, passes: true });
  });
});
