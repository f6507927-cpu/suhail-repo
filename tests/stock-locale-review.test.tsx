import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { stockCriterionLabel, stockReasonField, arabicKnownReason } from "../src/i18n/stock-labels";
import { CriteriaTable, ReasonList, isBooleanCriterion, ActivityEvidenceNote } from "../src/components/stock/StockVerdictParts";
import { Disclaimer } from "../src/components/foundation/Disclaimer";
import { PublishedResearch } from "../src/components/stock/PublishedResearch";
import type { StockCriterion, PublicStockData } from "../src/stock/types";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.stubGlobal("React", React);
function render(node: React.ReactNode) {
  return renderToStaticMarkup(<NextIntlClientProvider locale="ar" messages={ar}>{node}</NextIntlClientProvider>);
}
const business = {
  id: "business", criterion_type: "business_activity", criterion_label: "Prohibited primary business activity",
  threshold_unit: "absolute", threshold: 0, ratio: 0, result: "pass", input_states: ["estimated"],
  confidence_tier: "Estimated", source_ids: [], calculation_trace: "Primary activity: Fixture (from FY2025 filing) (technology); pass.",
} as unknown as StockCriterion;
describe("public Arabic criterion and reason presentation", () => {
  it.each([
    ["Prohibited primary business activity", "Primary business activity"],
    ["Interest-bearing debt / market value basis", "Interest-bearing debt to market value"],
    ["Prohibited income / total revenue", "Non-permissible income to total revenue"],
  ])(
    "localizes the exact governed label %s without changing the stored label", (label, english) => {
      expect(stockCriterionLabel({ criterion_label: label }, "ar")).toMatch(/[\u0600-\u06ff]/);
      expect(stockCriterionLabel({ criterion_label: label }, "ar")).not.toMatch(/[A-Za-z]/);
      // D-157 approves both display locales; the stored string remains the key.
      expect(stockCriterionLabel({ criterion_label: label }, "en")).toBe(english);
    });
  it("preserves arbitrary analyst labels rather than collapsing distinct definitions", () => {
    expect(stockCriterionLabel({ criterion_label: "Specific analyst evidence" }, "ar")).toBe("Specific analyst evidence");
  });
  it("localizes known reason fields and preserves approved Arabic §7.3 templates", () => {
    expect(stockReasonField("prohibited_income", "ar")).not.toContain("prohibited_income");
    expect(stockReasonField("Business segments", "ar")).not.toContain("Business segments");
    const reasons = [
      { kind: "review_unknown", reason_code: "numerator_unavailable", field: "prohibited_income" },
      { kind: "review_unknown", reason_code: "no_segments", field: "Business segments" },
      { kind: "criterion_unknown", reason_code: "no_segments", criterion_label: "Prohibited primary business activity" },
    ];
    const original = structuredClone(reasons);
    const html = render(<ReasonList reasons={reasons} locale="ar"/>);
    expect(html).not.toMatch(/prohibited_income:|Business segments:|Prohibited primary/);
    expect(html).toContain("لم يُسجَّل إفصاح عن القطاعات.");
    expect(reasons).toEqual(original);
  });
  it.each(["pass", "fail", "unknown"] as const)("business activity %s never displays its numeric sentinel", result => {
    const criterion = { ...business, result, ratio: result === "fail" ? 1 : 0 };
    expect(isBooleanCriterion(criterion)).toBe(true);
    const html = render(<CriteriaTable criteria={[criterion]} sources={new Map()} locale="ar"/>);
    expect(html).not.toMatch(/0\.00|1\.00/);
    expect(html).toContain(result === "pass" ? "اجتاز" : result === "fail" ? "لم يجتز" : "غير معروف");
  });
  it("shows the carry-forward source period and Estimated classification", () => {
    const html = render(<ActivityEvidenceNote criterion={business} locale="ar"/>);
    expect(html).toContain("FY2025");
    expect(html).toContain("تقديرية");
  });
  it("reuses approved missing-disclosure reasons without guessing translations of free text", () => {
    expect(arabicKnownReason("no segment disclosure recorded")).toBe("لم يُسجَّل إفصاح عن القطاعات.");
    expect(arabicKnownReason("An analyst-specific explanation")).toBeNull();
  });
  it("uses the exact existing Arabic disclaimer even if an English provider surrounds it", () => {
    const html = renderToStaticMarkup(<NextIntlClientProvider locale="en" messages={en}>
      <Disclaimer locale="ar" variant="full"/>
    </NextIntlClientProvider>);
    expect(html).toContain(ar.disclaimer.full);
    expect(html).not.toContain(en.disclaimer.full);
  });
  it("translates canonical stored disclaimers without replacing custom legal text", () => {
    const pick = { edition_label: "Fixture", disclaimer: en.disclaimer.full } as NonNullable<PublicStockData["publishedPick"]>;
    expect(render(<PublishedResearch pick={pick} locale="ar"/>)).toContain(ar.disclaimer.full);
    expect(render(<PublishedResearch pick={{ ...pick, disclaimer: "Specific legal qualification" }} locale="ar"/>))
      .toContain("Specific legal qualification");
  });
});
