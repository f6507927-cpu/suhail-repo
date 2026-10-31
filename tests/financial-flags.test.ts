import { describe, expect, it } from "vitest";
import { annotateSecChanges } from "../src/lib/financial/flags";
const baseline = { id: "baseline", company_id: "a", period_id: "2025", line_item: "assets",
  origin: "sec", value: 100, is_current: false, protected_current: false, sec_baseline_id: null };
const correction = { ...baseline, id: "correction", origin: "override", value: 111,
  is_current: true, protected_current: true, sec_baseline_id: baseline.id };
describe("SEC changed-since-correction flags", () => {
  it("does not flag the pre-existing difference introduced by the analyst", () => {
    expect(annotateSecChanges([correction, baseline])[0].sec_changed).toBe(false);
  });
  it("flags changed incoming SEC values, not a different company's or period's values", () => {
    const incoming = { ...baseline, id: "incoming", value: 120 };
    expect(annotateSecChanges([incoming, correction, baseline])[1].sec_changed).toBe(true);
    expect(annotateSecChanges([{ ...incoming, period_id: "2026" }, correction, baseline])[1].sec_changed).toBe(false);
    expect(annotateSecChanges([{ ...incoming, company_id: "b" }, correction, baseline])[1].sec_changed).toBe(false);
  });
  it("does not leave a stale historical flag when the latest SEC value matches baseline", () => {
    expect(annotateSecChanges([{ ...baseline, id: "latest" }, { ...baseline, id: "older", value: 120 },
      correction, baseline])[2].sec_changed).toBe(false);
  });
  it("clears flags when correction protection has been released", () => {
    expect(annotateSecChanges([{ ...correction, origin: "sec", protected_current: false },
      baseline])[0].sec_changed).toBe(false);
  });
});
