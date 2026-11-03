import { describe, expect, it } from "vitest";
import { upperBoundSummary } from "../src/ingest/sec/fsn/summary";

function row() {
  return { ticker: "SYNTH", reason: "No allowed income tag",
    balanceSheet: { components: {
      cash: { value: 100, state: "reported" },
      short_term: { value: 0, state: "not_on_balance_sheet" },
      long_term: { value: 0, state: "not_on_balance_sheet" },
    } },
    upperBound: { bound: 6, ratio: 0.6, used: true, passes: true, selectedIncome: null, reason: null as string | null },
  };
}
describe("upper-bound shell summary", () => {
  it("prints one line containing every requested field and retains absence labels", () => {
    expect(upperBoundSummary(row())).toBe("SYNTH cash=100 short-term=0 [not on balance sheet] " +
      "long-term=0 [not on balance sheet] bound=6 ratio=0.6% pass reason=Estimated upper bound; analyst overrides not checked");
  });
  it("never converts an excessive bound into fail or a rounded pass", () => {
    const r = row(); Object.assign(r.upperBound, { ratio: 5.00000001, passes: false, reason: "Bound exceeds limit" });
    expect(upperBoundSummary(r)).toContain("ratio=5.00000001% unknown reason=Bound exceeds limit");
    expect(upperBoundSummary(r)).not.toContain(" fail ");
  });
  it("explains unknown components and skipped stocks without multiline JSON", () => {
    const text = upperBoundSummary({ ticker: "LLY", upperBound: { bound: null, ratio: null },
      balanceSheet: { components: { cash: { value: null, reason: "Conflicting\ncash\tvalues" } } } });
    expect(text).toContain("cash=unknown short-term=unknown long-term=unknown bound=unknown ratio=unknown unknown");
    expect(text).toContain("Conflicting cash values");
    expect(text).not.toMatch(/[\r\n\t]/);
    expect(upperBoundSummary({ ticker: "ABSENT", reason: "No SEC CIK identity" })).toContain("reason=No SEC CIK identity");
  });
  it("does not claim the bound was used when an existing value, including zero, wins", () => {
    const r = row(); Object.assign(r.upperBound, { selectedIncome: 0, used: false });
    expect(upperBoundSummary(r)).toContain("unknown reason=Existing income takes precedence; bound not used");
  });
});
