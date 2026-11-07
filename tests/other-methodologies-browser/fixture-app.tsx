import React from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import ar from "../../src/i18n/messages/ar.json";
import en from "../../src/i18n/messages/en.json";
import { OtherMethodologies } from "../../src/components/stock/OtherMethodologies";
import type { OtherMethodologyResult, PublicStockData } from "../../src/stock/types";

// D-174 DB-free browser fixture: the real section and switcher, synthetic data only.
const locale = location.pathname.startsWith("/en") ? "en" : "ar";
const criterion = (o: Partial<OtherMethodologyResult["criteria"][number]>): OtherMethodologyResult["criteria"][number] => ({
  criterion_id: "c", criterion_label: "Total debt / total assets", criterion_type: "interest_bearing_debt", result: "pass",
  ratio: 12.4, threshold: 33.33, threshold_unit: "percent_of_total_assets", threshold_direction: "max",
  numerator_value: 1000000000, denominator_value: 8000000000, numerator_definition: "Interest-bearing borrowings + finance lease liabilities",
  sort_order: 2, ...o,
});
const others: OtherMethodologyResult[] = [
  { methodology: { name: "Research implementation based on publicly documented criteria from AAOIFI (Shari'ah Standard No. 21)", slug: "aaoifi-ss21-adapted", short_label: "AAOIFI SS 21 — adapted research" },
    version: { id: "a", version: "1.0", version_label: null },
    run: { id: "ra", status: "requires_review", status_reasons: [], generated_at: new Date("2026-11-07"), data_as_of: "2025-12-31", financial_period_label: "FY2025" },
    criteria: [criterion({ criterion_id: "d", criterion_label: "Interest-bearing deposits and investments / market capitalisation", criterion_type: "cash_and_investments", result: "unknown", ratio: null, threshold: 30, numerator_definition: "Cash, short-term and long-term investments (balance sheet)" })] },
  { methodology: { name: "Research implementation based on publicly documented criteria from the MSCI Islamic Index Series methodology", slug: "msci-islamic-adapted", short_label: "MSCI Islamic criteria — adapted research" },
    version: { id: "m", version: "1.0", version_label: null },
    run: { id: "rm", status: "fails_selected_methodology", status_reasons: [], generated_at: new Date("2026-11-07"), data_as_of: "2025-12-31", financial_period_label: "FY2025" },
    criteria: [criterion({}), criterion({ criterion_id: "r", criterion_label: "Accounts receivable and cash / total assets", criterion_type: "receivables", result: "fail", ratio: 72.53, threshold: 70, numerator_definition: "Accounts receivable + cash" })] },
];
const fact = (line_item: string, value: number) => ({ id: line_item, line_item, label: null, value, value_text: null, currency: "USD",
  unit_scale: "absolute", input_state: "reported", confidence_tier: "Verified", source_id: null, unknown_note: null });
const data = {
  methodology: { name: "Research implementation based on publicly documented criteria from Al Rajhi Capital", slug: "al-rajhi-adapted", scope: null, official_or_inspired: "adapted", is_demo: false },
  facts: [fact("interest_bearing_debt", 900000000), fact("finance_lease_liabilities", 100000000)],
  otherMethodologies: others,
} as unknown as PublicStockData;
createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
    <main style={{ width: "min(100% - 2.5rem, 68rem)", marginInline: "auto" }}><OtherMethodologies data={data} locale={locale} /></main>
  </NextIntlClientProvider>);
