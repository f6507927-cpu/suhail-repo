import type { PublicStockData, StockCriterion } from "../../src/stock/types";

export function uiOneFixture(): PublicStockData {
  const criterion: StockCriterion = {
    id: "activity", screening_run_id: "run", criterion_id: "activity",
    criterion_type: "business_activity", criterion_label: "Prohibited primary business activity",
    result: "fail", ratio: 1, threshold: null, threshold_unit: "boolean", threshold_direction: "boolean",
    numerator_value: 1, denominator_value: null, numerator_definition: "business_segments", denominator_definition: null,
    borderline_margin: null, source_ids: ["source"], input_states: ["reported"], confidence_tier: "Verified",
    calculation_trace: "business_segments", result_reason: "primary_prohibited", source_reference: null, sort_order: 0,
    explanation_ar: "شرح النشاط.", explanation_en: "This criterion checks the company's primary activity.",
  };
  return {
    security: { id: "security", slug: "fixture", ticker: "FIX", display_symbol: null, company_id: "company",
      exchange_id: null, coverage_analyst_id: null, is_demo: false },
    company: { id: "company", name: "SEC COMPANY", display_name_en: "Curated Company", name_ar: null,
      description_ar: null, description_en: null, sector_label: null, is_demo: false },
    exchange: { code: "NASDAQ", name: "New York Stock Exchange" },
    methodology: { name: "Research implementation based on publicly documented criteria from Al Rajhi Capital",
      slug: "fixture", scope: "Founder-authorized 25-security US research draft only; provisional G1 decisions remain pending analyst review.",
      official_or_inspired: "adapted", is_demo: false },
    version: { id: "version", version: "1.0", version_label: "Adapted research 1.0 — draft",
      workflow_status: "approved", production_enabled: false, is_demo: false },
    run: { id: "run", status: "fails_selected_methodology", status_reasons: [{
      kind: "failure", criterion_id: "activity", criterion_label: criterion.criterion_label, field: null,
      ratio: 1, threshold: null, threshold_unit: "boolean", reason_code: "primary_prohibited",
    }], confidence: "High", data_adequacy: "adequate", data_as_of: "2026-01-31", generated_at: new Date("2026-02-01"),
      immutable_hash: "a".repeat(64), calculation_version: "calc-2026.10.6", engine_version: "engine-1.0.1",
      financial_period_id: "period", financial_period_label: "FY2025", methodology_name: null, methodology_version_label: null, is_demo: false },
    criteria: [criterion, { ...criterion, id: "income", criterion_id: "income", criterion_type: "non_permissible_revenue",
      criterion_label: "Prohibited income / total revenue", threshold_unit: "percent_of_total_revenue", threshold_direction: "max",
      result: "unknown", ratio: null, numerator_value: null, denominator_value: 479_000_000_000, threshold: 5,
      numerator_definition: "prohibited_income", denominator_definition: "total_revenue", sort_order: 1,
      calculation_trace: "numerator unavailable; no value assumed", explanation_ar: null, explanation_en: null }],
    unknowns: [{ id: "unknown", screening_run_id: "run", criterion_id: "income", criterion_type: "non_permissible_revenue",
      criterion_label: "Prohibited income / total revenue", field_or_input: "prohibited_income",
      why_missing: "numerator unavailable; no value assumed", effect: "review", severity: "review", source_reference: null }],
    period: { id: "period", period_end: "2026-01-31", reported_date: "2026-02-01", fiscal_period_label: "FY2025", source_id: "source" },
    facts: [], priorRuns: [], sources: [{ id: "source", label: "Annual source", document_title: "This is an English source title.",
      source_type: "regulatory_filing", document_reference: "10-K", source_url: "https://example.test/filing", reporting_period: "FY2025" }],
    explanation: null, analyst: null,
  };
}

/** Realistic reason shapes per status, without running or changing the engine. */
export function setUiOneStatus(data: PublicStockData, status: NonNullable<PublicStockData["run"]>["status"] | null) {
  if (status === null) { data.run = null; return; }
  data.run!.status = status;
  if (status === "passes_selected_methodology") data.run!.status_reasons = [];
  if (status === "requires_review") data.run!.status_reasons = [{
    kind: "criterion_unknown", criterion_id: "income", criterion_label: "Prohibited income / total revenue",
    field: null, ratio: null, threshold: 5, threshold_unit: "percent_of_total_revenue", reason_code: "numerator_unavailable",
  }, {
    kind: "review_unknown", criterion_id: "income", criterion_label: "Prohibited income / total revenue",
    field: "prohibited_income", ratio: null, threshold: null, threshold_unit: null, reason_code: "numerator_unavailable",
  }];
  if (status === "insufficient_data") data.run!.status_reasons = [{
    kind: "blocking_unknown", criterion_id: "income", criterion_label: "Prohibited income / total revenue",
    field: "total_revenue", ratio: null, threshold: null, threshold_unit: null, reason_code: "denominator_unavailable",
  }];
}
