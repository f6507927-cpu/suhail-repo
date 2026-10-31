import { describe, expect, it } from "vitest";
import { criterion, fact, input, segment } from "./__fixtures__/synthetic";
import { EngineInputError, screen, type EngineInput } from "./index";
import { dateMillis } from "./validate";

describe("D-83/D-86/D-88: malformed contract throws typed errors", () => {
  it.each([
    ["duplicate fact", (i: EngineInput) => i.facts.push({ ...i.facts[0] })],
    ["duplicate segment", (i: EngineInput) => i.segments.push({ ...i.segments[0] })],
    ["duplicate criterion", (i: EngineInput) => i.methodologyVersion.criteria.push({ ...i.methodologyVersion.criteria[0] })],
    ["empty numerator", (i: EngineInput) => i.methodologyVersion.criteria[0].numeratorLineItems = []],
    ["empty denominator", (i: EngineInput) => i.methodologyVersion.criteria[0].denominatorLineItems = []],
    ["both empty", (i: EngineInput) => {
      i.methodologyVersion.criteria[0].numeratorLineItems = [];
      i.methodologyVersion.criteria[0].denominatorLineItems = [];
    }],
  ])("%s", (_, mutate) => {
    const i = input();
    (mutate as (i: EngineInput) => void)(i);
    expect(() => screen(i)).toThrow(EngineInputError);
  });
  it.each([NaN, Infinity, -Infinity])("rejects nonfinite number %s everywhere", (value) => {
    const mutations = [
      (i: EngineInput) => i.facts[0].value = value,
      (i: EngineInput) => i.segments[0].revenueAmount = value,
      (i: EngineInput) => i.segments[0].revenueShare = value,
      (i: EngineInput) => i.methodologyVersion.criteria[0].threshold = value,
      (i: EngineInput) => i.methodologyVersion.criteria[0].borderlineMargin = value,
      (i: EngineInput) => i.methodologyVersion.criteria[0].sortOrder = value,
      (i: EngineInput) => i.methodologyVersion.criteria[0].treatmentRuleData = { nested: [{ invalid: value }] },
    ];
    for (const mutate of mutations) {
      const i = input();
      mutate(i);
      expect(() => screen(i)).toThrow(EngineInputError);
    }
  });
  it.each([0, -1, 1.5, NaN, Infinity, null, "550"])("invalid staleness limit %s", (limit) => {
    expect(() => screen(input({ stalenessLimitDays: limit as number }))).toThrow(EngineInputError);
  });
  it.each(["2026-02-30", "not-a-date", "2026-2-01", "2026-13-01", "2026-01-01T00:00:00Z"])("malformed date %s", (value) => {
    expect(() => dateMillis(value, "test")).toThrow(EngineInputError);
    for (const mutate of [
      (i: EngineInput) => i.asOf = value,
      (i: EngineInput) => i.period.periodEnd = value,
      (i: EngineInput) => i.methodologyVersion.criteria[0].effectiveDate = value,
    ]) {
      const i = input(); mutate(i);
      expect(() => screen(i)).toThrow(EngineInputError);
    }
  });
  it("supports leap days, UTC date differences and typed field metadata", () => {
    expect(dateMillis("2024-02-29", "test")).toBe(Date.parse("2024-02-29T00:00:00Z"));
    const error = new EngineInputError("asOf", "invalid date");
    expect(error.name).toBe("EngineInputError");
    expect(error.field).toBe("asOf");
    expect(error.message).toBe("asOf: invalid date");
  });
  it.each(["reported", "derived", "estimated"] as const)("D-88: null %s fact is contradictory", (state) => {
    expect(() => screen(input({ facts: [fact("interest_bearing_debt", null, state)] }))).toThrow(EngineInputError);
  });
  it("D-84: unknown nullable or numeric facts/segments remain valid gaps", () => {
    expect(() => screen(input({
      facts: [fact("interest_bearing_debt", null, "unknown"), fact("total_assets", 100)],
      segments: [segment({ inputState: "unknown", revenueAmount: null, revenueShare: null })],
    }))).not.toThrow();
  });
  it("rejects missing required metadata and unknown enums, but not unsupported evaluator names", () => {
    const paths = [
      ["securityId"], ["asOf"], ["engineVersion"], ["calculationVersion"],
      ["methodologyVersion", "id"], ["methodologyVersion", "criteria"],
      ["period", "periodEnd"], ["facts", 0, "sourceId"], ["facts", 0, "confidenceTier"],
      ["segments", 0, "confidenceTier"], ["segments", 0, "activityCategory"],
      ["methodologyVersion", "criteria", 0, "thresholdDirection"],
      ["methodologyVersion", "criteria", 0, "thresholdUnit"],
      ["methodologyVersion", "criteria", 0, "numeratorDefinition"],
      ["methodologyVersion", "criteria", 0, "treatmentRuleData"],
    ];
    for (const path of paths) {
      const i = input();
      let node = i as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
      delete node[path.at(-1)!];
      expect(() => screen(i), path.join(".")).toThrow(EngineInputError);
    }
    for (const [collection, field] of [
      ["facts", "inputState"], ["facts", "confidenceTier"],
      ["segments", "inputState"], ["segments", "confidenceTier"], ["segments", "activityCategory"],
    ]) {
      const i = input();
      const rows = (i as unknown as Record<string, Record<string, unknown>[]>)[collection];
      rows[0][field] = "invalid-enum";
      expect(() => screen(i)).toThrow(EngineInputError);
    }
    for (const field of ["thresholdDirection", "thresholdUnit"]) {
      const i = input();
      (i.methodologyVersion.criteria[0] as unknown as Record<string, unknown>)[field] = "invalid-enum";
      expect(() => screen(i)).toThrow(EngineInputError);
    }
    const i = input();
    i.methodologyVersion.criteria[0].criterionType = "future_evaluator";
    expect(screen(i).status).toBe("insufficient_data");
  });
  it.each(["business_activity", "non_permissible_revenue"])("requires valid configured category lists for %s", (criterionType) => {
    const i = input();
    i.methodologyVersion.criteria = [criterion({ criterionType })];
    expect(() => screen(i)).toThrow(EngineInputError);
    const key = criterionType === "business_activity" ? "prohibited_categories" : "non_permissible_categories";
    for (const invalid of [null, "alcohol", ["invalid-enum"]]) {
      i.methodologyVersion.criteria[0].treatmentRuleData = { [key]: invalid };
      expect(() => screen(i)).toThrow(EngineInputError);
    }
    i.methodologyVersion.criteria[0].treatmentRuleData = { [key]: [] };
    expect(() => screen(i)).not.toThrow();
  });
});
