import { describe, expect, it, vi } from "vitest";
import { criterion, fact, input, segment } from "./__fixtures__/synthetic";
import { screen, type Criterion, type ConfidenceTier, type EngineInput, type InputState } from "./index";
import { decide, formatNumber, roundRatio } from "./math";
import { factSum, weakest } from "./evidence";

function ratioInput(value: number, overrides: Partial<Criterion> = {}): EngineInput {
  const i = input();
  i.facts[0].value = value;
  i.methodologyVersion.criteria = [criterion(overrides)];
  return i;
}
function business(segments = [segment()]): EngineInput {
  const i = input({ segments });
  i.methodologyVersion.criteria = [criterion({
    criterionType: "business_activity", thresholdDirection: "boolean", thresholdUnit: "boolean", threshold: null,
    treatmentRuleData: { prohibited_categories: ["alcohol", "gambling"] },
  })];
  return i;
}
function nonpermissible(segments = [segment()]): EngineInput {
  const i = input({ segments, facts: [fact("total_revenue", 100)] });
  i.methodologyVersion.criteria = [criterion({
    criterionType: "non_permissible_revenue", threshold: 5, thresholdUnit: "percent_of_total_revenue",
    numeratorDefinition: "Non-permissible revenue", denominatorDefinition: "total revenue",
    treatmentRuleData: { non_permissible_categories: ["alcohol", "gambling"] },
  })];
  return i;
}
describe("rounded result rules", () => {
  it.each([
    [33, { thresholdDirection: "max" }, "pass"],
    [34, { thresholdDirection: "max" }, "fail"],
    [33, { thresholdDirection: "min" }, "pass"],
    [32, { thresholdDirection: "min" }, "fail"],
    [0, { thresholdDirection: "boolean" }, "pass"],
    [1, { thresholdDirection: "boolean" }, "fail"],
    [-1, { thresholdDirection: "boolean" }, "pass"],
    [1, { threshold: null }, "fail"],
    [0, { threshold: null }, "pass"],
    [32, { borderlineMargin: 1 }, "borderline"],
    [34, { borderlineMargin: 1 }, "borderline"],
    [33, { borderlineMargin: 0 }, "borderline"],
    [31.99, { borderlineMargin: 1 }, "pass"],
    [34.01, { borderlineMargin: 1 }, "fail"],
    [33, { borderlineMargin: null }, "pass"],
    [33.004, { borderlineMargin: null }, "fail"],
    [33.005, { borderlineMargin: null }, "fail"],
  ] as [number, Partial<Criterion>, string][])("value %s, %j → %s", (value, changes, result) => {
    expect(screen(ratioInput(value, changes)).criteria[0].result).toBe(result);
  });
  it.each([
    [1.005, 1.01], [-1.005, -1.01], [2.675, 2.68], [-2.675, -2.68],
    [1.0049, 1], [-1.0049, -1], [0.005, 0.01], [-0.005, -0.01],
    [0.004, 0], [-0.004, 0], [-0, 0], [1e-7, 0], [1e21, 1e21], [12, 12],
  ])("half-away rounding %s → %s", (value, expected) => {
    expect(roundRatio(value)).toBe(expected);
    expect(Object.is(roundRatio(value), -0)).toBe(false);
  });
  it("compares exact distances without rounding thresholds or margins", () => {
    expect(decide(5.1, criterion({ threshold: 5, borderlineMargin: 0.1 })).result).toBe("borderline");
    expect(decide(4.9, criterion({ threshold: 5, borderlineMargin: 0.1 })).result).toBe("borderline");
    expect(decide(5, criterion({ threshold: 5.004, borderlineMargin: 0.001 })).result).toBe("pass");
    expect(decide(-5, criterion({ threshold: -5.1, borderlineMargin: 0.1 })).result).toBe("borderline");
    expect(decide(1e-7, criterion({ threshold: 1e-7, borderlineMargin: 1e-9 })).result).toBe("borderline");
    expect(decide(1e21, criterion({ threshold: 1e21, borderlineMargin: 0 })).result).toBe("borderline");
  });
  it.each(["absolute", "boolean", "percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap"] as const)(
    "uses correct unit scaling for %s", (thresholdUnit) => {
      const c = screen(ratioInput(12, { thresholdUnit })).criteria[0];
      expect(c.ratio).toBe(thresholdUnit.startsWith("percent_") ? 12 : 0.12);
      expect(c.calculationTrace).toContain(thresholdUnit.startsWith("percent_") ? "12.00%" : "0.12");
    },
  );
  it("emits deterministic English numbers and trace", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
    const i = input({ facts: [fact("interest_bearing_debt", 12000000), fact("total_assets", 50000000)] });
    expect(screen(i).criteria[0].calculationTrace).toBe("Interest-bearing debt (12,000,000) ÷ total assets (50,000,000) = 24.00%");
  });
});

describe("ratio evidence and unknown precedence", () => {
  it.each(["interest_bearing_debt", "cash_and_investments", "receivables", "custom_ratio"])("registry evaluates %s", (criterionType) => {
    expect(screen(ratioInput(12, { criterionType })).criteria[0].ratio).toBe(12);
  });
  it("sums every configured component and preserves definitions/states/sources", () => {
    const i = input({
      facts: [fact("a", 12, "derived"), { ...fact("b", 8, "estimated"), confidenceTier: "Estimated" }, fact("c", 40), fact("d", 60)],
    });
    i.methodologyVersion.criteria = [criterion({
      numeratorLineItems: ["a", "b"], denominatorLineItems: ["c", "d"],
      numeratorDefinition: "A plus B", denominatorDefinition: "C plus D", sortOrder: 7,
    })];
    const c = screen(i).criteria[0];
    expect(c).toMatchObject({
      numeratorValue: 20, denominatorValue: 100, ratio: 20,
      numeratorDefinition: "A plus B", denominatorDefinition: "C plus D",
      inputStates: ["derived", "estimated", "reported"], confidenceTier: "Estimated", sortOrder: 7,
    });
    expect(c.sourceIds).toEqual(["fixture-source-a", "fixture-source-b", "fixture-source-c", "fixture-source-d"]);
  });
  it.each(["missing", "unknown"] as const)("denominator %s → blocking", (state) => {
    const i = input();
    i.facts = state === "missing" ? [i.facts[0]] : [i.facts[0], fact("total_assets", null, "unknown")];
    const r = screen(i);
    expect(r).toMatchObject({ status: "insufficient_data", dataAdequacy: "inadequate", confidence: "Low" });
    expect(r.criteria[0]).toMatchObject({ ratio: null, denominatorValue: null, result: "unknown" });
    expect(r.criteria[0].inputStates).toContain(state);
    expect(r.unknowns[0].severity).toBe("blocking");
  });
  it.each([0, -100])("D-79: denominator %s → exact nonpositive explanation", (value) => {
    const i = input();
    i.facts[1].value = value;
    const r = screen(i);
    expect(r.status).toBe("insufficient_data");
    expect(r.unknowns[0]).toMatchObject({
      severity: "blocking", explanation: "denominator is zero or negative; ratio undefined; no value assumed",
    });
  });
  it.each(["missing", "unknown"] as const)("D-88: numerator %s → review / low", (state) => {
    const i = input();
    i.facts = state === "missing" ? [i.facts[1]] : [fact("interest_bearing_debt", null, "unknown"), i.facts[1]];
    const r = screen(i);
    expect(r).toMatchObject({ status: "requires_review", dataAdequacy: "adequate_with_estimates", confidence: "Low" });
    expect(r.criteria[0].inputStates).toContain(state);
    expect(r.unknowns[0].severity).toBe("review");
  });
  it("D-84: unknown fact with supplied number remains unavailable", () => {
    const i = input({ facts: [fact("interest_bearing_debt", 0, "unknown"), fact("total_assets", 100)] });
    expect(screen(i).criteria[0].numeratorValue).toBeNull();
    i.facts[0] = fact("interest_bearing_debt", 12);
    i.facts[1].inputState = "unknown";
    expect(screen(i).criteria[0].denominatorValue).toBeNull();
  });
  it("reports both missing sides, not just the first", () => {
    const r = screen(input({ facts: [] }));
    expect(r.unknowns.map((u) => u.severity)).toEqual(["blocking", "review"]);
    expect(r.criteria[0].confidenceTier).toBeNull();
  });
  it("does not assume a sum when one component is absent", () => {
    const i = ratioInput(12, { numeratorLineItems: ["interest_bearing_debt", "absent"] });
    expect(screen(i).criteria[0].numeratorValue).toBeNull();
    expect(factSum(["unknown"], [fact("unknown", null, "unknown")]).value).toBeNull();
  });
  it("D-79: explicit fail outranks blocking unknown", () => {
    const i = ratioInput(90);
    i.methodologyVersion.criteria.push(criterion({ id: "missing-denominator", denominatorLineItems: ["absent"] }));
    expect(screen(i)).toMatchObject({ status: "fails_selected_methodology", dataAdequacy: "inadequate", confidence: "Low" });
  });
  it("D-44/D-62: leases are not silently folded into debt", () => {
    const i = input();
    i.facts.push(fact("finance_lease_liabilities", 999), fact("operating_lease_liabilities", 999));
    expect(screen(i).criteria[0].numeratorValue).toBe(12);
    i.methodologyVersion.criteria[0].numeratorLineItems.push("finance_lease_liabilities");
    expect(screen(i).criteria[0].numeratorValue).toBe(1011);
  });
  it.each(["unsupported", "__proto__", "constructor"])("unregistered %s blocks, never throws or passes", (criterionType) => {
    const r = screen(ratioInput(12, { criterionType }));
    expect(r.status).toBe("insufficient_data");
    expect(r.criteria[0]).toMatchObject({ result: "unknown", resultReasonCode: "evaluator_unregistered", confidenceTier: null });
    expect(r.unknowns[0].explanation).toContain("no evaluator is registered");
  });
});

describe("primary business activity (D-13/D-80/D-84/D-85)", () => {
  it.each([["alcohol", "fail"], ["technology", "pass"], ["unclassified", "unknown"]])(
    "%s primary → %s", (activityCategory, result) => {
      const r = screen(business([segment({ activityCategory })]));
      expect(r.criteria[0].result).toBe(result);
      if (result === "unknown") expect(r.unknowns[0].severity).toBe("review");
    },
  );
  it("no segments is review, never sector evidence", () => {
    const i = business([]);
    Object.assign(i, { sector: "technology" });
    expect(screen(i)).toMatchObject({ status: "requires_review", confidence: "Low" });
    expect(screen(i).unknowns[0].reasonCode).toBe("no_segments");
  });
  it("any undisclosed segment prevents guessing the largest", () => {
    const r = screen(business([segment(), segment({ segmentName: "undisclosed", revenueShare: null, revenueAmount: null })]));
    expect(r.status).toBe("requires_review");
    expect(r.unknowns[0].reasonCode).toBe("shares_unavailable");
  });
  it("derives missing shares only when all amounts are available", () => {
    const r = screen(business([
      segment({ revenueShare: null, revenueAmount: 80 }),
      segment({ segmentName: "Secondary", revenueShare: null, revenueAmount: 20, activityCategory: "alcohol" }),
    ]));
    expect(r.criteria[0].result).toBe("pass");
    expect(r.criteria[0].calculationTrace).toContain("Fixture technology (technology)");
  });
  it("uses disclosed share even when amount is absent", () => {
    expect(screen(business([segment({ revenueAmount: null })])).criteria[0].result).toBe("pass");
  });
  it.each([0, -100])("missing share with total %s is review", (revenueAmount) => {
    expect(screen(business([segment({ revenueShare: null, revenueAmount })])).unknowns[0].severity).toBe("review");
  });
  it("unavailable amount anywhere prevents deriving a share", () => {
    expect(screen(business([
      segment({ revenueShare: null }), segment({ segmentName: "Other", revenueAmount: null }),
    ])).criteria[0].result).toBe("unknown");
  });
  it("unknown state overrides both supplied share and amount", () => {
    expect(screen(business([segment({ inputState: "unknown" })])).criteria[0].result).toBe("unknown");
  });
  it.each([
    ["alcohol", "technology"], ["technology", "alcohol"], ["alcohol", "gambling"],
    ["alcohol", "unclassified"],
  ])("D-80: prohibited tie %s/%s is review, never fail", (a, b) => {
    const r = screen(business([
      segment({ activityCategory: a, revenueShare: 0.5 }),
      segment({ segmentName: "Other", activityCategory: b, revenueShare: 0.5 }),
    ]));
    expect(r.status).toBe("requires_review");
    expect(r.criteria[0].result).toBe("unknown");
    expect(r.unknowns[0]).toMatchObject({ severity: "review", explanation: "primary activity tied between segments" });
  });
  it("all-permissible tie passes", () => {
    expect(screen(business([
      segment({ revenueShare: 0.5 }), segment({ segmentName: "Other", activityCategory: "healthcare", revenueShare: 0.5 }),
    ])).criteria[0].result).toBe("pass");
  });
  it("unclassified tied primary retains D-13 review handling", () => {
    expect(screen(business([
      segment({ revenueShare: 0.5 }), segment({ segmentName: "Other", activityCategory: "unclassified", revenueShare: 0.5 }),
    ])).unknowns[0].reasonCode).toBe("unclassified_primary");
  });
});

describe("non-permissible revenue", () => {
  it.each([[4, "pass"], [6, "fail"]])("%s% → %s", (value, result) => {
    const r = screen(nonpermissible([
      segment({ revenueAmount: 100 - Number(value), revenueShare: 1 - Number(value) / 100 }),
      segment({ segmentName: "Alcohol", revenueAmount: Number(value), revenueShare: Number(value) / 100, activityCategory: "alcohol" }),
    ]));
    expect(r.criteria[0]).toMatchObject({ numeratorValue: value, denominatorValue: 100, ratio: value, result });
  });
  it.each([
    segment({ activityCategory: "unclassified" }), segment({ revenueAmount: null }),
    segment({ inputState: "unknown", revenueAmount: 10 }),
  ])("category/amount gap creates review unknown %j", (s) => {
    expect(screen(nonpermissible([s])).criteria[0].numeratorValue).toBeNull();
    expect(screen(nonpermissible([s])).unknowns[0].severity).toBe("review");
  });
  it("D-86: no segments never assumes zero", () => {
    const r = screen(nonpermissible([]));
    expect(r.status).toBe("requires_review");
    expect(r.unknowns[0].explanation).toBe("no segment disclosure recorded");
  });
  it("total revenue missing blocks; denominator formula is always total_revenue", () => {
    const i = nonpermissible();
    i.facts = [];
    expect(screen(i).status).toBe("insufficient_data");
    i.facts = [fact("total_revenue", 100)];
    i.methodologyVersion.criteria[0].denominatorLineItems = ["irrelevant"];
    expect(screen(i).criteria[0].denominatorValue).toBe(100);
  });
  it("applies the same borderline rule", () => {
    const i = nonpermissible([segment({ activityCategory: "alcohol", revenueAmount: 5 })]);
    i.methodologyVersion.criteria[0].borderlineMargin = 0.5;
    expect(screen(i).criteria[0].result).toBe("borderline");
  });
});

describe("quality, weakest tiers and supplied-date freshness", () => {
  it.each([
    ["reported", "adequate", "High"], ["derived", "adequate", "High"],
    ["estimated", "adequate_with_estimates", "Medium"], ["unknown", "adequate_with_estimates", "Low"],
  ] as [InputState, string, string][])("state %s → %s / %s", (state, dataAdequacy, confidence) => {
    const i = input();
    i.facts[0].inputState = state;
    expect(screen(i)).toMatchObject({ dataAdequacy, confidence });
  });
  it.each(["Verified", "Calculated", "Estimated", "AI Interpretation"] as ConfidenceTier[])("tiers are distinct from states: %s", (tier) => {
    const i = input();
    i.facts[0].confidenceTier = tier;
    expect(screen(i)).toMatchObject({ dataAdequacy: "adequate", confidence: "High" });
    expect(screen(i).criteria[0].confidenceTier).toBe(tier);
  });
  it("all weakest-tier pairs, including empty evidence", () => {
    const tiers: ConfidenceTier[] = ["Verified", "Calculated", "Estimated", "AI Interpretation"];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      expect(weakest([tiers[a], tiers[b]])).toBe(tiers[Math.max(a, b)]);
    }
    expect(weakest([])).toBeNull();
  });
  it("D-81: segment tiers affect business and non-permissible evidence", () => {
    for (const i of [business(), nonpermissible()]) {
      i.segments[0].confidenceTier = "AI Interpretation";
      expect(screen(i).criteria[0].confidenceTier).toBe("AI Interpretation");
    }
  });
  it("D-81: all fact/segment weakest-tier pairs are carried into criterion evidence", () => {
    const tiers: ConfidenceTier[] = ["Verified", "Calculated", "Estimated", "AI Interpretation"];
    for (let a = 0; a < tiers.length; a++) for (let b = 0; b < tiers.length; b++) {
      const i = nonpermissible();
      i.facts[0].confidenceTier = tiers[a];
      i.segments[0].confidenceTier = tiers[b];
      const r = screen(i);
      expect(r.criteria[0].confidenceTier).toBe(tiers[Math.max(a, b)]);
      expect(r.confidence).toBe("High"); // state/tier distinction survives the combination
    }
  });
  it("only used facts affect quality; all segments still affect quality", () => {
    const i = input();
    const before = screen(i);
    i.facts.push(fact("unused", null, "unknown"));
    i.methodologyVersion.criteria[0].requiredInputs.push("unused"); // D-87
    const after = screen(i);
    expect(after.confidence).toBe(before.confidence);
    expect(after.dataAdequacy).toBe(before.dataAdequacy);
    expect(after.criteria).toEqual(before.criteria);
    i.segments[0].inputState = "estimated";
    expect(screen(i).confidence).toBe("Medium");
    i.segments[0].inputState = "unknown";
    expect(screen(i).confidence).toBe("Low");
  });
  it.each([[550, "passes_selected_methodology"], [551, "requires_review"]])("freshness %s days → %s", (days, status) => {
    const i = input();
    i.period.periodEnd = "2024-01-01";
    i.asOf = new Date(Date.parse("2024-01-01T00:00:00Z") + Number(days) * 86400000).toISOString().slice(0, 10);
    const r = screen(i);
    expect(r.status).toBe(status);
    expect(r.unknowns.some((u) => u.field === "Data freshness")).toBe(days === 551);
    expect(r.confidence).toBe(days === 551 ? "Medium" : "High");
  });
  it("custom freshness limit and fail/blocking/unknown quality precedence", () => {
    const i = input({ asOf: "2026-01-02", stalenessLimitDays: 1 });
    i.period.periodEnd = "2026-01-01";
    expect(screen(i).confidence).toBe("High");
    i.asOf = "2026-01-03";
    expect(screen(i).confidence).toBe("Medium");
    i.facts[0].inputState = "unknown";
    expect(screen(i).confidence).toBe("Low");
    i.facts = [];
    expect(screen(i).dataAdequacy).toBe("inadequate");
    i.facts = [fact("interest_bearing_debt", 90), fact("total_assets", 100)];
    expect(screen(i).status).toBe("fails_selected_methodology");
    expect(screen(i).confidence).toBe("Medium");
  });
  it("does not read the clock or mutate frozen inputs", () => {
    const i = input();
    function freeze(value: unknown) {
      if (value && typeof value === "object") {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
      }
    }
    freeze(i);
    const initial = screen(i);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2099-01-01"));
      expect(screen(i)).toEqual(initial);
      vi.setSystemTime(new Date("1900-01-01"));
      expect(screen(i)).toEqual(initial);
    } finally { vi.useRealTimers(); }
  });
});
