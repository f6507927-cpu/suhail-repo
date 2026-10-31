import { describe, expect, it } from "vitest";
import { criterion, input, goldenInput } from "./__fixtures__/synthetic";
import { renderArabicDraft, renderEnglish, screen, type ReasonCode, type StatusReason } from "./index";
import { buildReasons } from "./reasons/structured";

describe("D-42: structured reasons and §7.3 precedence", () => {
  it("failures list every failure plus borderline/unknown counts, not unknown prose", () => {
    const i = input();
    i.methodologyVersion.criteria = [
      criterion({ id: "fail-1", threshold: 10 }),
      criterion({ id: "fail-2", threshold: 11 }),
      criterion({ id: "borderline", threshold: 12, borderlineMargin: 1 }),
      criterion({ id: "review-unknown", numeratorLineItems: ["missing"] }),
      criterion({ id: "blocking", denominatorLineItems: ["missing"] }),
    ];
    const r = screen(i);
    expect(r.statusReasons.map((s) => s.kind)).toEqual(["failure", "failure", "counts"]);
    expect(r.statusReasons.at(-1)).toMatchObject({ borderlineCount: 1, unknownCount: 2 });
    expect(r.statusReasons[0]).toMatchObject({
      criterionId: "fail-1", label: "Fixture ratio", ratio: 12, threshold: 10, reasonCode: "max_exceeded",
    });
    expect(JSON.stringify(r.statusReasons)).not.toContain("explanation");
  });
  it("insufficient data lists only blocking unknowns", () => {
    const i = input({ facts: [] });
    i.asOf = "2030-01-01";
    const r = screen(i);
    expect(r.statusReasons).toHaveLength(1);
    expect(r.statusReasons[0].kind).toBe("blocking_unknown");
    expect(renderEnglish(r.statusReasons[0])).toBe("total assets: cannot be evaluated; screen is Insufficient Data; no value assumed");
  });
  it("review lists borderline/unknown criteria plus every review unknown", () => {
    const i = input();
    i.methodologyVersion.criteria = [
      criterion({ id: "borderline", threshold: 12, borderlineMargin: 0 }),
      criterion({ id: "unknown", numeratorLineItems: ["missing"] }),
    ];
    i.asOf = "2030-01-01";
    const r = screen(i);
    expect(r.statusReasons.map((s) => s.kind)).toEqual(["borderline", "criterion_unknown", "review_unknown", "review_unknown"]);
    expect(r.statusReasons.at(-1)).toMatchObject({ criterionId: null, field: "Data freshness", reasonCode: "stale_data" });
  });
  it("pass has no status reasons and all-zero fail counts remain explicit", () => {
    expect(screen(input()).statusReasons).toEqual([]);
    const r = screen(goldenInput("A", "fail"));
    expect(r.statusReasons.at(-1)).toMatchObject({ borderlineCount: 0, unknownCount: 0 });
    // Unknowns of blocking severity are never accidentally included as review lines.
    expect(buildReasons("requires_review", [], [{
      criterionId: null, label: "Blocking", field: "X", reasonCode: "evaluator_unregistered",
      severity: "blocking", explanation: "unregistered",
    }])).toEqual([]);
  });
});

describe("deterministic English templates and D-101 approved Arabic", () => {
  const base: StatusReason = {
    kind: "failure", criterionId: "fixture", label: "Debt", ratio: 40, threshold: 33,
    thresholdUnit: "percent_of_total_assets", reasonCode: "max_exceeded", field: null,
  };
  it("failure uses the exact §7.3 English pattern", () => {
    expect(renderEnglish(base)).toBe("Debt criterion: Fail — 40.00% against a 33% limit. The ratio exceeds the limit.");
  });
  it.each([
    "failure", "borderline", "criterion_unknown", "blocking_unknown", "review_unknown", "counts",
  ] as const)("renders %s in each locale without modifying reasons", (kind) => {
    const reason = Object.freeze({
      ...base, kind, field: "total assets", borderlineCount: 2, unknownCount: 3,
    });
    expect(renderEnglish(reason)).toBeTruthy();
    expect(renderArabicDraft(reason)).not.toMatch(/⟦AR-REVIEW⟧|رمز السبب/);
    expect(reason.kind).toBe(kind);
  });
  it("absolute/boolean/null units do not claim percentages or invent a threshold", () => {
    expect(renderEnglish({ ...base, thresholdUnit: "absolute" })).toContain("40.00 against a 33 limit");
    expect(renderEnglish({ ...base, thresholdUnit: "boolean", threshold: null })).toContain("not set");
    expect(renderEnglish({ ...base, thresholdUnit: null, threshold: null, ratio: null })).toContain("unknown against a not set limit");
    expect(renderEnglish({ ...base, kind: "counts", borderlineCount: 0, unknownCount: 1 })).toBe("0 borderline criteria; 1 unknown criteria.");
  });
  it("all locale-independent reason codes have English templates", () => {
    const codes: ReasonCode[] = [
      "boolean_positive", "boolean_nonpositive", "within_margin", "max_within_limit", "max_exceeded",
      "min_met", "min_not_met", "denominator_unavailable", "denominator_nonpositive",
      "numerator_unavailable", "no_segments", "shares_unavailable", "unclassified_primary",
      "primary_tied", "primary_prohibited", "primary_permissible", "evaluator_unregistered",
      "stale_data", "criterion_counts",
    ];
    for (const reasonCode of codes) expect(renderEnglish({ ...base, reasonCode })).not.toMatch(/\. undefined$/);
  });
  it.each([
    ["failure", "معيار Debt: لم يجتز الفحص — النسبة 40.00% مقابل حد 33%. تتجاوز النسبة الحد."],
    ["borderline", "معيار Debt: نتيجة حدية — النسبة 40.00% مقابل حد 33%. تتجاوز النسبة الحد."],
    ["criterion_unknown", "معيار Debt: النتيجة غير معروفة — تتجاوز النسبة الحد."],
    ["blocking_unknown", "total assets: تتجاوز النسبة الحد."],
    ["review_unknown", "total assets: تتجاوز النسبة الحد."],
    ["counts", "عدد المعايير الحدية: 0؛ عدد المعايير غير المعروفة: 1."],
  ] as const)("renders the exact approved %s template", (kind, expected) => {
    const reason = Object.freeze({
      ...base, kind, field: "total assets", borderlineCount: 0, unknownCount: 1,
    });
    expect(renderArabicDraft(reason)).toBe(expected);
    expect(reason).toEqual({ ...base, kind, field: "total assets", borderlineCount: 0, unknownCount: 1 });
  });
  it.each([
    ["percent_of_total_assets", "%"],
    ["percent_of_market_cap", "%"],
    ["percent_of_total_revenue", "%"],
    ["absolute", ""],
    ["boolean", ""],
    [null, ""],
  ] as const)("matches English number formatting for unit %s", (thresholdUnit, suffix) => {
    const reason = { ...base, ratio: 36.009, threshold: 33, thresholdUnit };
    expect(renderArabicDraft(reason)).toContain(`النسبة 36.01${suffix} مقابل حد 33${suffix}.`);
    expect(renderEnglish(reason)).toContain(`36.01${suffix} against a 33${suffix} limit.`);
    const fraction = { ...reason, ratio: 0, threshold: 33.125 };
    expect(renderArabicDraft(fraction)).toContain(`النسبة 0.00${suffix} مقابل حد 33.125${suffix}.`);
    expect(renderArabicDraft({ ...reason, ratio: null })).toContain(`غير معروف مقابل حد 33${suffix}`);
    expect(renderArabicDraft({ ...reason, threshold: null })).toContain(`36.01${suffix} مقابل حد غير محدد`);
    expect(renderArabicDraft({ ...reason, ratio: null, threshold: null })).toContain("غير معروف مقابل حد غير محدد");
    expect(renderArabicDraft(reason)).not.toMatch(/[٠-٩۰-۹]|رمز السبب|max_exceeded/);
  });
  it.each(["blocking_unknown", "review_unknown"] as const)(
    "does not repeat unavailable-input explanations for %s",
    (kind) => {
      const text = renderArabicDraft({ ...base, kind, field: "الأصول", reasonCode: "denominator_nonpositive" });
      expect(text).toBe("الأصول: المقام صفر أو سالب؛ النسبة غير معرّفة؛ لم تُفترض أي قيمة.");
      expect(text.match(/لم تُفترض أي قيمة/g)).toHaveLength(1);
    },
  );
});
