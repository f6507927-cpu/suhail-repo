import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../../src/components/stock/StockVerdict";
import { loadPublicStock } from "../../src/db/stock-public";
import { stockMetadata } from "../../src/stock/metadata";
import ar from "../../src/i18n/messages/ar.json";
import en from "../../src/i18n/messages/en.json";
import { DISPLAY_TIME_ZONE } from "../../src/lib/format";

// Test-only SSR harness. Uses the real public-role loader, metadata builder and
// presentation. No real-app auth, DB guards, route handlers or config are aliased.
export async function renderStock(slug: string, locale: "ar" | "en", variant?: string | null) {
  const data = await loadPublicStock(slug);
  if (!data) return null;
  // Component-state coverage only; no stored data or real route is modified.
  if (variant === "passed" || variant === "failed") data.explanation = {
    id: "fixture-explanation", ai_text: "Fixture narrative grounded in stored evidence.",
    validation_status: variant, evidence: [{ claim: "Fixture evidence statement" }], unknowns: [],
  };
  if (variant === "history" && data.run) data.priorRuns = [15, 14].map(day => ({
    ...data.run!, id: `fixture-prior-${day}`, generated_at: new Date(`2026-10-${day}T00:00:00Z`), immutable_hash: `${day}`.repeat(32),
  }));
  if (variant === "reverse-fallback" && data.analyst) data.analyst = { ...data.analyst, name_ar: "اسم اختباري", name_en: null };
  if (variant === "precision" && data.criteria[0]) {
    const base = data.criteria[0];
    data.criteria = [
      { ...base, id: "near-threshold", criterion_label: "Near threshold fixture", threshold_unit: "percent_of_total_assets", result: "fail", ratio: 30.004, threshold: 30, numerator_definition: null, numerator_value: 123, denominator_definition: null, denominator_value: 100 },
      { ...base, id: "tiny-boolean", criterion_label: "Tiny boolean fixture", threshold_unit: "boolean", result: "fail", ratio: 1e-9, threshold: 0 },
    ];
  }
  return {
    html: renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone={DISPLAY_TIME_ZONE}><StockVerdict data={data} locale={locale} /></NextIntlClientProvider>),
    metadata: stockMetadata(data, locale, "http://127.0.0.1:3400"),
  };
}
