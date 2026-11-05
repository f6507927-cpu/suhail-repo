import { describe, expect, it, vi } from "vitest";
import { selectActivityEvidence } from "../src/lib/financial/activity-evidence";
import { sicActivity, SIC_AMBIGUOUS, SIC_PROHIBITED } from "../src/lib/financial/sic-activity";
import { exampleCriteria, goldenInput } from "../src/engine/__fixtures__/synthetic";
import { screen } from "../src/engine";
import type { businessSegment, financialPeriod } from "../src/db/schema/market";
vi.mock("server-only", () => ({}));
type Segment = typeof businessSegment.$inferSelect;
type Period = typeof financialPeriod.$inferSelect;
const period = { id: "previous", fiscal_period_label: "FY2025", period_end: "2025-09-27" } as Period;
const row = { id: "segment", period_id: "previous", segment_name: "Synthetic technology",
  created_by: "analyst", source_id: "filing", category_basis: "Reviewed analyst classification",
  activity_category: "technology", revenue_amount: 100, revenue_share: 1,
  input_state: "reported", confidence_tier: "Verified" } as Segment;

describe("annual activity rollover", () => {
  it("carries only classification and historical share, labelled Estimated and source period", () => {
    const before = structuredClone(row);
    expect(selectActivityEvidence([], [row], period, "2026-10-01")).toEqual([{
      ...row, segment_name: "Synthetic technology (from FY2025 filing)",
      revenue_amount: null, input_state: "estimated", confidence_tier: "Estimated",
    }]);
    expect(row).toEqual(before);
  });
  it("current analyst evidence, including an explicit unknown, always wins", () => {
    const current = [{ ...row, period_id: "current", activity_category: "unclassified" as const }];
    expect(selectActivityEvidence(current, [row], period, "2026-10-01")).toBe(current);
  });
  it.each(["2027-03-28", "2025-09-26"])("rejects stale/future source periods at %s", asOf => {
    expect(selectActivityEvidence([], [row], period, asOf)).toEqual([]);
  });
  it("includes the exact 18-month boundary and refuses unsourced/unapproved/partial evidence", () => {
    expect(selectActivityEvidence([], [row], period, "2027-03-27")).toHaveLength(1);
    expect(selectActivityEvidence([], [row], { ...period, period_end: "2025-09-30" }, "2027-03-31")).toHaveLength(1);
    for (const change of [{ source_id: null }, { created_by: null }, { category_basis: "" },
      { activity_category: "unclassified" as const }, { input_state: "unknown" as const }])
      expect(selectActivityEvidence([], [row, { ...row, ...change }], period, "2026-10-01")).toEqual([]);
  });
});
function evaluate(code: number) {
  const input = goldenInput("A", "pass");
  input.methodologyVersion.criteria = exampleCriteria("A").filter(c => c.criterionType === "business_activity");
  input.segments = [sicActivity(code, "sec-sic-source")!];
  return screen(input);
}
describe("founder SIC mapping v1: one fixture per entry", () => {
  for (const [category, codes] of Object.entries(SIC_PROHIBITED))
    it.each(codes)(`${category}: %s fails on Estimated SIC evidence`, code => {
      expect(sicActivity(code, "sec-sic-source")).toMatchObject({
        activityCategory: category, inputState: "estimated", confidenceTier: "Estimated",
        sourceId: "sec-sic-source", segmentName: expect.stringContaining("pending analyst review"),
      });
      expect(evaluate(code).criteria[0].result).toBe("fail");
    });
  it.each(SIC_AMBIGUOUS)("ambiguous %s stays unknown for analyst review", code => {
    const output = evaluate(code);
    expect(output.criteria[0].result).toBe("unknown");
    expect(output.status).toBe("requires_review");
  });
  it.each([3571, 7372, 2834, 100])("other SIC %s passes only the activity criterion as Estimated", code => {
    expect(evaluate(code).criteria[0]).toMatchObject({ result: "pass", confidenceTier: "Estimated" });
  });
  it.each([NaN, 0, 99999, 6020.5])("invalid code %s cannot imply permissible activity", code => {
    expect(sicActivity(code, "source")).toBeNull();
  });
});
