import { describe, expect, it } from "vitest";
import { criterion, fact, goldenInput, input } from "./__fixtures__/synthetic";
import { screen, ENGINE_VERSION, CALCULATION_VERSION, verify } from "./index";

describe("D-125/D-127 unrounded decisions and historical dispatch", () => {
  for (const [line, denominator, threshold] of [
    ["interest_bearing_debt", "market_value_basis", 30],
    ["prohibited_income", "total_revenue", 5],
  ] as const) {
    it.each([[-0.004, "pass"], [0, "pass"], [0.004, "fail"]] as const)(
      `${line}: threshold + %s is %s without a margin`, (offset, result) => {
        const i = input({ facts: [fact(line, threshold + offset), fact(denominator, 100)],
          methodologyVersion: { id: "adapted-fixture", label: "Synthetic ratios, not methodology approval",
            criteria: [criterion({ criterionType: "custom_ratio", numeratorLineItems: [line],
              denominatorLineItems: [denominator], threshold, borderlineMargin: null })] } });
        const actual = screen(i);
        expect(actual.criteria[0]).toMatchObject({ result, ratio: threshold });
        expect(verify(actual.hashPayload, actual.immutableHash)).toBe(true);
        const historic = screen({ ...i, engineVersion: "engine-1.0.1", calculationVersion: "calc-2026.10.3" });
        expect(historic.criteria[0].result).toBe("pass");
        expect(historic.immutableHash).not.toBe(actual.immutableHash);
        i.methodologyVersion.criteria[0].borderlineMargin = 0;
        expect(screen(i).criteria[0].result).toBe(offset === 0 ? "borderline" : result);
      });
    it(`${line}: estimated values pass, missing/unknown values do not`, () => {
      const i = input({ facts: [fact(line, 1, "estimated"), fact(denominator, 100)],
        methodologyVersion: { id: "test", label: "Synthetic", criteria: [criterion({
          criterionType: "custom_ratio", numeratorLineItems: [line], denominatorLineItems: [denominator],
          threshold, borderlineMargin: null })] } });
      expect(screen(i)).toMatchObject({ status: "passes_selected_methodology", confidence: "Medium", dataAdequacy: "adequate_with_estimates" });
      i.facts[0] = fact(line, null, "unknown");
      expect(screen(i).status).toBe("requires_review");
      i.facts = [fact(line, 1)];
      expect(screen(i).status).toBe("insufficient_data");
    });
  }
  it("preserves historical golden hashes while exercising current versions", () => {
    for (const example of ["A", "B"] as const) for (const outcome of ["pass", "review", "fail", "insufficient"] as const) {
      const i = goldenInput(example, outcome);
      const old = screen(i);
      const modern = screen({ ...i, engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION });
      expect(modern.hashPayload.outputs).toEqual(old.hashPayload.outputs);
      expect(modern.immutableHash).not.toBe(old.immutableHash);
    }
  });
  it("retains sub-ten-decimal input precision for new-run replay", () => {
    const i = input({ facts: [fact("interest_bearing_debt", 30.000000000001), fact("total_assets", 100)] });
    i.methodologyVersion.criteria[0].threshold = 30;
    i.methodologyVersion.criteria[0].borderlineMargin = null;
    const r = screen(i);
    expect(r.criteria[0]).toMatchObject({ result: "fail", ratio: 30 });
    expect((r.hashPayload.facts as { value: number }[]).some(f => f.value === 30.000000000001)).toBe(true);
    expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
  });
});
