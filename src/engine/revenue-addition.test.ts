import { describe, expect, it } from "vitest";
import { criterion, fact, input, segment } from "./__fixtures__/synthetic";
import { screen, verify } from "./index";
import { EngineInputError } from "./errors";
import type { Criterion, Fact } from "./types";

// D-172: MSCI §2.1 counts interest income inside the cumulative revenue screen.
const revenue = (overrides: Partial<Criterion> = {}) => criterion({
  criterionType: "non_permissible_revenue", numeratorLineItems: ["business_segments"],
  denominatorLineItems: ["total_revenue"], thresholdUnit: "percent_of_total_revenue", threshold: 5,
  borderlineMargin: null, treatmentRuleData: { non_permissible_categories: ["alcohol"],
    additional_numerator_line_items: ["prohibited_income"] }, ...overrides,
});
const run = (facts: Fact[], c = revenue()) => screen(input({ facts,
  segments: [segment({ segmentName: "Bar", activityCategory: "alcohol", revenueAmount: 2, revenueShare: null }),
    segment({ segmentName: "Software", activityCategory: "technology", revenueAmount: 98, revenueShare: null })],
  methodologyVersion: { id: "msci-fixture", label: "Synthetic", criteria: [c] } }));

describe("configured revenue additions", () => {
  it.each([[2.9, "pass"], [3, "pass"], [3.1, "fail"]] as const)(
    "prohibited segments 2 + interest %s over revenue 100 is %s (at 5% passes)", (interest, result) => {
      const r = run([fact("total_revenue", 100), fact("prohibited_income", interest, "estimated")]);
      expect(r.criteria[0]).toMatchObject({ result, numeratorValue: 2 + interest, denominatorValue: 100 });
      expect(r.criteria[0].inputStates).toContain("estimated");
      expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
    });
  it("unknown or missing interest makes the numerator unknown, never zero", () => {
    expect(run([fact("total_revenue", 100), fact("prohibited_income", null, "unknown")]).criteria[0])
      .toMatchObject({ result: "unknown", resultReasonCode: "numerator_unavailable" });
    expect(run([fact("total_revenue", 100)]).criteria[0]).toMatchObject({ result: "unknown" });
  });
  it("without the option the evaluator ignores prohibited_income exactly as before", () => {
    const plain = revenue({ treatmentRuleData: { non_permissible_categories: ["alcohol"] } });
    const r = run([fact("total_revenue", 100), fact("prohibited_income", 50)], plain);
    expect(r.criteria[0]).toMatchObject({ result: "pass", numeratorValue: 2 });
  });
  it("unclassified segments still block the numerator", () => {
    const r = screen(input({ facts: [fact("total_revenue", 100), fact("prohibited_income", 0)],
      segments: [segment({ activityCategory: "unclassified" })],
      methodologyVersion: { id: "x", label: "x", criteria: [revenue()] } }));
    expect(r.criteria[0].result).toBe("unknown");
  });
  it.each([
    ["another evaluator", { criterionType: "custom_ratio", numeratorLineItems: ["prohibited_income"] }],
    ["another line item", { treatmentRuleData: { non_permissible_categories: ["alcohol"], additional_numerator_line_items: ["net_income"] } }],
  ] as const)("refuses %s", (_name, overrides) => {
    expect(() => run([fact("total_revenue", 100), fact("prohibited_income", 1)],
      revenue(overrides as unknown as Partial<Criterion>))).toThrow(EngineInputError);
  });
  it("refuses the option on historical engine replay", () => {
    const i = input({ facts: [fact("total_revenue", 100), fact("prohibited_income", 1)], segments: [segment()],
      methodologyVersion: { id: "x", label: "x", criteria: [revenue()] } });
    expect(() => screen({ ...i, engineVersion: "engine-1.0.1", calculationVersion: "calc-2026.10.3" })).toThrow(EngineInputError);
  });
});
