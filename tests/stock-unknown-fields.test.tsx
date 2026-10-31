import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { screen } from "../src/engine";
import { criterion, fact, input } from "../src/engine/__fixtures__/synthetic";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import type { PublicStockData } from "../src/stock/types";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { displayLabel } from "../src/i18n/presentation";
import approvedFollowUp from "../src/i18n/approved-arabic-follow-up.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);

// Exercise the real engine's free-text field projection, rather than treating
// the field_or_input text column as an enum in a synthetic label-only test.
const denominator = "Configured average asset denominator";
function missingEvidence(): PublicStockData {
  const source = input({
    asOf: "2026-10-18", period: { id: "period", label: "FY2023", periodEnd: "2023-12-31" },
    facts: [fact("interest_bearing_debt", 5)],
  });
  source.methodologyVersion.criteria = [criterion({ denominatorDefinition: denominator })];
  const result = screen(source);
  expect(result.unknowns.map(item => item.field)).toContain(denominator);
  expect(result.unknowns.map(item => item.field)).toContain("Data freshness");
  return {
    security: { id: "security", slug: "fixture-unknowns", ticker: "FXU", display_symbol: null,
      company_id: "company", exchange_id: null, coverage_analyst_id: null, is_demo: true },
    company: { id: "company", name: "Fixture company", name_ar: null, description_ar: null,
      description_en: null, sector_label: null, is_demo: true },
    exchange: null, methodology: null, version: null, period: null, facts: [], criteria: [],
    sources: [], priorRuns: [], analyst: null, explanation: null,
    run: { id: "run", status: result.status, status_reasons: [], confidence: result.confidence,
      data_adequacy: result.dataAdequacy, data_as_of: source.period.periodEnd, generated_at: new Date("2026-10-18T00:00:00Z"),
      immutable_hash: "a".repeat(64), calculation_version: "test", engine_version: "test",
      financial_period_id: null, financial_period_label: source.period.label, is_demo: true,
      methodology_name: "Fixture method", methodology_version_label: "v1" },
    unknowns: [...result.unknowns.map((unknown, index) => ({
      id: `unknown-${index}`, screening_run_id: "run", criterion_id: unknown.criterionId,
      criterion_type: null, criterion_label: unknown.label, field_or_input: unknown.field,
      why_missing: unknown.explanation, effect: null, source_reference: null, severity: unknown.severity,
    })), {
      id: "known-key", screening_run_id: "run", criterion_id: null, criterion_type: null, criterion_label: null,
      field_or_input: "total_assets", why_missing: null, effect: null, source_reference: null, severity: "blocking",
    }],
  };
}

describe("stock rendering preserves missing-input identities", () => {
  it.each(["ar", "en"] as const)("renders D-138 conditional public sections in %s", locale => {
    const data = missingEvidence();
    data.unknowns = [];
    data.run!.methodology_name = null;
    data.explanation = { id: "explanation", ai_text: null, validation_status: "not_run", evidence: [], unknowns: [] };
    const html = renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="Asia/Riyadh">
      <StockVerdict data={data} locale={locale} />
    </NextIntlClientProvider>);
    for (const source of ["No unknown inputs were recorded for this run.", "No criterion evidence was stored for this run.",
      "Methodology unavailable", "DETERMINISTIC RECORD", "RECORDED GAPS", "Run hash", "Why this assessment",
      "Change history / prior runs", "No validated narrative text is stored; structured evidence only."] as const) {
      expect(html, source).toContain(locale === "ar" ? approvedFollowUp[source] : source);
    }
    expect(html).toContain("a".repeat(64));
  });
  it.each(["ar", "en"] as const)("renders missing denominator and stale-data names distinctly in %s", locale => {
    const html = renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="Asia/Riyadh">
      <StockVerdict data={missingEvidence()} locale={locale} />
    </NextIntlClientProvider>);
    const section = html.match(/<section\b[^>]*data-section="unknown"[\s\S]*?<\/section>/)![0];
    const headings = [...section.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(match => match[1]);
    const names = headings.map(heading => heading.replace(/<[^>]+>/g, ""));
    const prefix = locale === "ar" ? "⟦AR-REVIEW⟧ " : "";
    expect(names).toEqual([`${prefix}${denominator}`, `${prefix}Data freshness`, displayLabel("lineItem", "total_assets", locale)]);
    expect(names.join(" ")).not.toMatch(/Unrecognized label|تسمية غير معروفة|total_assets/);
    for (const heading of headings.slice(0, 2)) {
      expect(heading).toMatch(/<bdi lang="en" dir="ltr">[^<]+<\/bdi>/);
    }
    expect([...section.matchAll(/data-language-notice=/g)]).toHaveLength(locale === "ar" ? 1 : 0);
  });
});
