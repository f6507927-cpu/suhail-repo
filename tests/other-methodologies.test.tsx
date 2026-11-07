import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { OtherMethodologyResult, PublicStockData } from "../src/stock/types";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);
import { OtherMethodologies, decidingCriterion } from "../src/components/stock/OtherMethodologies";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { initialMethodology } from "../src/components/stock/MethodologySwitcher";

type Locale = "ar" | "en";
const render = (element: React.ReactNode, locale: Locale = "ar") => renderToStaticMarkup(
  <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{element}</NextIntlClientProvider>);
const criterion = (overrides: Partial<OtherMethodologyResult["criteria"][number]>): OtherMethodologyResult["criteria"][number] => ({
  criterion_id: "c", criterion_label: "Total debt / total assets", criterion_type: "interest_bearing_debt", result: "pass",
  ratio: 10, threshold: 33.33, threshold_unit: "percent_of_total_assets", threshold_direction: "max",
  numerator_value: 1000, denominator_value: 10000, numerator_definition: "Interest-bearing borrowings + finance lease liabilities",
  sort_order: 0, ...overrides,
});
const msci = (status: "passes_selected_methodology" | "fails_selected_methodology", criteria: OtherMethodologyResult["criteria"]): OtherMethodologyResult => ({
  methodology: { name: "Research implementation based on publicly documented criteria from the MSCI Islamic Index Series methodology", slug: "msci-islamic-adapted", short_label: "MSCI Islamic criteria — adapted research" },
  version: { id: "msci-v", version: "1.0", version_label: null },
  run: { id: "r", status, status_reasons: [], generated_at: new Date("2026-11-07"), data_as_of: "2025-12-31", financial_period_label: "FY2025" },
  criteria,
});
const aaoifi: OtherMethodologyResult = {
  methodology: { name: "Research implementation based on publicly documented criteria from AAOIFI (Shari'ah Standard No. 21)", slug: "aaoifi-ss21-adapted", short_label: "AAOIFI SS 21 — adapted research" },
  version: { id: "a-v", version: "1.0", version_label: null }, run: null, criteria: [],
};
function data(others: OtherMethodologyResult[] | undefined): PublicStockData {
  return {
    company: { id: "co", name: "Fixture Co", name_ar: null, display_name_en: null, description_ar: null, description_en: null, sector_label: null, is_demo: false },
    security: { id: "s", company_id: "co", exchange_id: null, coverage_analyst_id: null, display_symbol: null, ticker: "FIX", slug: "fix", is_demo: false },
    run: null, version: { id: "v", version: "1.1", version_label: null, production_enabled: true, is_demo: false },
    methodology: { name: "Research implementation based on publicly documented criteria from Al Rajhi Capital", slug: "al-rajhi-adapted", scope: null, official_or_inspired: "adapted", is_demo: false },
    period: null, criteria: [], unknowns: [], priorRuns: [], explanation: null, analyst: null, exchange: null, sources: [],
    facts: [{ id: "f1", line_item: "interest_bearing_debt", label: null, value: 900, value_text: null, currency: "USD", unit_scale: "absolute", input_state: "reported", confidence_tier: "Verified", source_id: null, unknown_note: null },
      { id: "f2", line_item: "finance_lease_liabilities", label: null, value: 100, value_text: null, currency: "USD", unit_scale: "absolute", input_state: "reported", confidence_tier: "Verified", source_id: null, unknown_note: null }],
    otherMethodologies: others,
  } as PublicStockData;
}

describe("other methodologies section (D-174)", () => {
  it("is absent when no other methodology is production-enabled", () => {
    expect(render(<OtherMethodologies data={data([])} locale="ar" />)).toBe("");
    expect(render(<OtherMethodologies data={data(undefined)} locale="en" />)).toBe("");
  });
  it("names the criterion that decided each status and never combines results", () => {
    const failed = msci("fails_selected_methodology", [criterion({}), criterion({ criterion_id: "r", criterion_label: "Accounts receivable and cash / total assets", criterion_type: "receivables", result: "fail", ratio: 72.5, threshold: 70, numerator_definition: "Accounts receivable + cash" })]);
    expect(decidingCriterion(failed)?.criterion_id).toBe("r");
    expect(decidingCriterion(msci("passes_selected_methodology", [criterion({})]))).toBeNull();
    for (const locale of ["ar", "en"] as const) {
      const html = render(<OtherMethodologies data={data([failed, aaoifi])} locale={locale} />, locale);
      expect(html).toContain('data-section="other-methodologies"');
      expect(html).toContain('data-methodology-card="msci-islamic-adapted"');
      expect(html).toContain('data-methodology-card="aaoifi-ss21-adapted"');
      expect(html).toContain("Accounts receivable and cash / total assets");
      expect(html).toContain("72.5%");
      expect(html).toContain(`${locale === "en" ? "/en" : ""}/methodology/msci-islamic-adapted`);
      expect(html).toContain("Not yet screened under this methodology.");
      expect(html).not.toMatch(/combined score|overall score|average/i);
    }
  });
  it("shows the total-debt components used (interest-bearing debt + finance leases)", () => {
    const html = render(<OtherMethodologies data={data([msci("passes_selected_methodology", [criterion({})])])} locale="en" />, "en");
    expect(html).toContain("data-debt-components");
    expect(html).toContain("900");
    expect(html).toContain("100");
    expect(html).toContain("1,000");
  });
  it("server render lists every result with the default selected (first visit, no JavaScript)", () => {
    const html = render(<OtherMethodologies data={data([msci("passes_selected_methodology", []), aaoifi])} locale="ar" />);
    expect(html).toContain('data-selected-methodology="al-rajhi-adapted"');
    expect(html).toMatch(/data-methodology-option="al-rajhi-adapted"[^>]*|aria-pressed="true"[^>]*data-methodology-option="al-rajhi-adapted"/);
    expect(html.match(/data-methodology-card=/g)).toHaveLength(2);
  });
  it("is placed in the stock page without changing other sections", () => {
    const html = render(<StockVerdict data={data([aaoifi])} locale="ar" />);
    expect(html).toContain('data-section="other-methodologies"');
    expect(render(<StockVerdict data={data(undefined)} locale="ar" />)).not.toContain("other-methodologies");
  });
});

describe("methodology choice (browser only; never the site default)", () => {
  const slugs = ["al-rajhi-adapted", "aaoifi-ss21-adapted", "msci-islamic-adapted"];
  it.each([
    ["first visit", "", null, "al-rajhi-adapted"],
    ["?m= link wins", "?m=msci-islamic-adapted", "aaoifi-ss21-adapted", "msci-islamic-adapted"],
    ["saved choice", "", "aaoifi-ss21-adapted", "aaoifi-ss21-adapted"],
    ["unknown link falls back to saved", "?m=demo-a", "aaoifi-ss21-adapted", "aaoifi-ss21-adapted"],
    ["stale saved value falls back to default", "", "retired-method", "al-rajhi-adapted"],
  ] as const)("%s", (_name, search, saved, expected) => {
    expect(initialMethodology([...slugs], "al-rajhi-adapted", search, saved)).toBe(expected);
  });
});
