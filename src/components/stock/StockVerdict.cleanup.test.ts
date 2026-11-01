import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import ar from "../../i18n/messages/ar.json";
import en from "../../i18n/messages/en.json";
import { StockVerdict } from "./StockVerdict";
import { criteriaNeedFallback, unknownsNeedFallback, sourcesNeedFallback, statusReasonsNeedFallback, structuredEvidenceNeedsFallback } from "./StockVerdictParts";
import type { PublicStockData } from "@/stock/types";

vi.mock("server-only", () => ({}));
vi.mock("../../i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);

function stockFixture(): PublicStockData {
  return {
    security: {
      id: "security-fixture", slug: "fixture-stock", ticker: "FXT", display_symbol: null,
      company_id: "company-fixture", exchange_id: null, coverage_analyst_id: null, is_demo: false,
    },
    company: {
      id: "company-fixture", name: "شركة الاختبار", name_ar: "شركة الاختبار",
      description_ar: null, description_en: null, sector_label: null, is_demo: false,
    },
    exchange: { code: "NYSE", name: "NYSE" },
    methodology: {
      name: "منهجية الفحص", slug: "fixture-method", scope: "نطاق المنهجية العربية",
      official_or_inspired: "adapted", is_demo: false,
    },
    version: { id: "version-fixture", version: "v1", version_label: "الإصدار الأول", production_enabled: true, is_demo: false },
    run: {
      id: "run-fixture", status: "requires_review",
      status_reasons: [{
        kind: "review_unknown", criterion_id: null, criterion_label: null, ratio: null, threshold: null,
        threshold_unit: null, reason_code: "stale_data", field: "حداثة البيانات",
      }],
      confidence: "Medium", data_adequacy: "adequate", data_as_of: "2025-12-31",
      generated_at: new Date("2026-01-08T00:00:00Z"), immutable_hash: "fixture-hash",
      calculation_version: "calc-fixture", engine_version: "engine-fixture",
      financial_period_id: "period-fixture", financial_period_label: "FY2025", is_demo: false,
      methodology_name: "منهجية الفحص", methodology_version_label: "الإصدار الأول",
    },
    criteria: [
      {
        id: "numeric-criterion", screening_run_id: "run-fixture", criterion_id: null,
        criterion_type: "custom_ratio", criterion_label: "نسبة الإيرادات",
        result: "pass", numerator_value: 10, numerator_definition: "البسط العربي",
        denominator_value: 100, denominator_definition: "المقام العربي", ratio: 0.1,
        threshold: 0.2, threshold_unit: "percent_of_total_revenue", threshold_direction: "max",
        borderline_margin: null, input_states: ["reported"], confidence_tier: "Verified",
        source_ids: ["source-fixture"], calculation_trace: "الحساب العربي",
        result_reason: null, source_reference: "مرجع المصدر", sort_order: 1,
      },
      {
        id: "boolean-criterion", screening_run_id: "run-fixture", criterion_id: null,
        criterion_type: "business_activity", criterion_label: "النشاط التجاري",
        result: "pass", numerator_value: null, numerator_definition: null,
        denominator_value: null, denominator_definition: null, ratio: null,
        threshold: null, threshold_unit: "boolean", threshold_direction: "boolean",
        borderline_margin: null, input_states: ["reported"], confidence_tier: "Verified",
        source_ids: ["source-fixture"], calculation_trace: null,
        result_reason: null, source_reference: "مرجع المصدر", sort_order: 2,
      },
    ],
    unknowns: [{
      id: "unknown-fixture", screening_run_id: "run-fixture", criterion_id: null, criterion_type: null,
      criterion_label: null, field_or_input: "بيانات غير متاحة", why_missing: "لم يرد الإفصاح",
      effect: "يحد من التقييم", source_reference: "مرجع", severity: "review",
    }],
    explanation: {
      id: "explanation-fixture", ai_text: null, validation_status: "not_run",
      evidence: [{ amount: 128.4, result: true }], unknowns: [{ value: false }],
    },
    priorRuns: [],
    period: {
      id: "period-fixture", fiscal_period_label: "FY2025", period_end: "2025-12-31",
      reported_date: "2026-01-08", source_id: "source-fixture",
    },
    facts: [{
      id: "fact-fixture", line_item: "total_revenue", label: null, value: 128.4, value_text: null,
      currency: "USD", unit_scale: "millions", input_state: "reported", confidence_tier: "Verified",
      source_id: "source-fixture", unknown_note: null,
    }],
    sources: [{
      id: "source-fixture", label: "إفصاح سنوي", source_type: "annual_report",
      document_title: "التقرير السنوي", document_reference: "10-K-2025",
      source_url: null, reporting_period: "FY2025",
    }],
    analyst: null,
  };
}

function renderStock(data: PublicStockData, locale: "ar" | "en" = "ar") {
  const providerProps = {
    locale,
    messages: locale === "ar" ? ar : en,
    timeZone: "UTC",
    children: null,
  };
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, providerProps,
    React.createElement(StockVerdict, { data, locale })));
}

const englishFallbackCases: Array<[string, (data: PublicStockData) => void]> = [
  ["company name", data => { data.company.name = "Fixture Systems"; data.company.name_ar = null; }],
  ["company sector", data => { data.company.sector_label = "Consumer technology"; }],
  ["exchange description", data => { data.exchange = { code: "XNYS", name: "New York Stock Exchange" }; }],
  ["analyst name", data => {
    data.security.coverage_analyst_id = "analyst-fixture";
    data.analyst = {
      name_ar: "", name_en: "Samira Analyst", title_ar: null, title_en: "Research director",
      credentials: null, bio_ar: null, bio_en: null, headshot_object_key: null,
    };
  }],
  ["analyst credentials", data => {
    data.security.coverage_analyst_id = "analyst-fixture";
    data.analyst = {
      name_ar: "سميرة", name_en: "Samira", title_ar: "مديرة أبحاث", title_en: "Research director",
      credentials: "CFA, FRM", bio_ar: null, bio_en: null, headshot_object_key: null,
    };
  }],
  ["methodology name", data => { data.methodology!.name = "Revenue screen"; }],
  ["stored run methodology name", data => {
    data.methodology = null;
    data.run!.methodology_name = "Revenue screen";
  }],
  ["methodology scope", data => { data.methodology!.scope = "Annual revenue and asset screening."; }],
  ["criterion label", data => { data.criteria[0].criterion_label = "Revenue ratio"; }],
  ["criterion definition", data => { data.criteria[0].numerator_definition = "Annual prohibited income"; }],
  ["criterion calculation trace", data => { data.criteria[0].calculation_trace = "Total revenue divided by total assets."; }],
  ["unknown field", data => { data.unknowns[0].field_or_input = "Data freshness"; }],
  ["unknown explanation", data => { data.unknowns[0].why_missing = "No annual filing was found."; }],
  ["unknown effect", data => { data.unknowns[0].effect = "The result needs review."; }],
  ["status reason label", data => {
    data.run!.status_reasons = [{
      kind: "criterion_unknown", criterion_id: null, criterion_label: "Revenue ratio",
      ratio: null, threshold: null, threshold_unit: null, reason_code: "numerator_unavailable", field: null,
    }];
  }],
  ["status reason field", data => {
    data.run!.status_reasons[0] = {
      kind: "review_unknown", criterion_id: null, criterion_label: null,
      ratio: null, threshold: null, threshold_unit: null, reason_code: "stale_data", field: "Data freshness",
    };
  }],
  ["free-text fact", data => {
    data.facts[0].value = null;
    data.facts[0].value_text = "Revenue was not reported.";
  }],
  ["source title", data => { data.sources[0].document_title = "Annual report"; }],
  ["source label fallback", data => { data.sources[0].document_title = null; data.sources[0].label = "Annual filing"; }],
  ["structured evidence string", data => { data.explanation!.evidence = [{ claim: "Revenue increased during the year." }]; }],
];

describe("stock public-label cleanup (D-150)", () => {
  it("does not show a notice for a fully Arabic stock record with numeric and boolean evidence", () => {
    const data = stockFixture();
    data.explanation!.evidence = [{ description: "بيان عربي" }];
    expect({
      criteria: criteriaNeedFallback(data.criteria),
      unknowns: unknownsNeedFallback(data.unknowns),
      sources: sourcesNeedFallback(data.sources, data),
      reasons: statusReasonsNeedFallback(data.run!.status_reasons),
      evidence: structuredEvidenceNeedsFallback(data.explanation!.evidence),
      structuredUnknowns: structuredEvidenceNeedsFallback(data.explanation!.unknowns),
    }).toEqual({ criteria: false, unknowns: false, sources: false, reasons: false, evidence: false, structuredUnknowns: false });
    const html = renderStock(data);
    expect(html).not.toContain("data-language-notice");
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });

  it.each(englishFallbackCases)("shows one header notice for displayed English-only %s", (_name, addFallback) => {
    const data = stockFixture();
    addFallback(data);
    const html = renderStock(data);
    const header = html.match(/<header\b[^>]*data-section="header"[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(header).toContain("data-language-notice");
    expect([...html.matchAll(/data-language-notice=/g)]).toHaveLength(1);
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });

  it("does not classify criterion source references, codes, or numeric values as English narrative", () => {
    const data = stockFixture();
    data.criteria[0].criterion_label = "النسبة";
    data.criteria[0].source_reference = "10-K accession 0001234567";
    data.sources[0].document_reference = "0001234567";
    data.facts[0].currency = "USD";
    data.facts[0].value = 123.45;
    data.period!.reported_date = null;
    const html = renderStock(data);
    expect(html).not.toContain("data-language-notice");
  });

  it("suppresses a review marker embedded in displayed structured evidence without altering the fixture", () => {
    const data = stockFixture();
    data.explanation!.evidence = [{ claim: "⟦AR-REVIEW⟧ Future narrative" }];
    const html = renderStock(data);
    expect(html).not.toContain("⟦AR-REVIEW⟧");
    expect(data.explanation!.evidence).toEqual([{ claim: "⟦AR-REVIEW⟧ Future narrative" }]);
    expect([...html.matchAll(/data-language-notice=/g)]).toHaveLength(1);
  });
});
