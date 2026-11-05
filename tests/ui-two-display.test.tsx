import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { StockFigures, RatioNote } from "../src/components/stock/StockSummary";
import { StockDate } from "../src/components/stock/StockDate";
import { FundamentalValue } from "../src/components/stock/FundamentalValue";
import { uiTwoFixture } from "./fixtures/ui-two-stock";
import { formatCalendarDate, formatFullDollars } from "../src/lib/format";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);
const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'");
function render(node: React.ReactNode, locale: "ar" | "en") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
}

describe("UI-2 stock number/date presentation", () => {
  it("keeps Arabic dates in day-month-year order and body-font RTL text, isolating only digit runs", () => {
    const html = render(<StockDate value="2025-12-31" locale="ar" />, "ar");
    expect(text(html)).toBe("31 ديسمبر 2025");
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('<bdi dir="ltr">31</bdi> ديسمبر <bdi dir="ltr">2025</bdi>');
    expect(html).not.toMatch(/font-mono|dir="ltr"[^>]*>[^<]*ديسمبر/);
    expect(formatCalendarDate("2025-12-31", "ar")).toBe("31 ديسمبر 2025");
    expect(text(render(<StockDate value="2026-11-03T22:00:00Z" locale="ar" />, "ar"))).toBe("4 نوفمبر 2026");
  });
  it.each(["ar", "en"] as const)("uses one date format in summary, all four figures, prior runs and stored close in %s", locale => {
    const data = uiTwoFixture();
    const before = structuredClone(data);
    const html = render(<StockVerdict data={data} locale={locale} />, locale);
    const dates = [...html.matchAll(/<time\b[^>]*>(.*?)<\/time>/gs)].map(match => text(match[1]));
    expect(dates.filter(date => date === formatCalendarDate("2025-12-31", locale)).length).toBeGreaterThanOrEqual(5);
    expect(dates).toContain(locale === "ar" ? "4 نوفمبر 2026" : "November 4, 2026");
    expect(dates).toContain(locale === "ar" ? "30 أكتوبر 2026" : "October 30, 2026");
    expect(text(html)).not.toContain("04/11/2026");
    const recordStart = html.indexOf('data-section="full-record"');
    const closingIndex = html.indexOf("data-stored-close");
    expect(closingIndex).toBeGreaterThan(html.indexOf('aria-label='));
    expect(closingIndex).toBeLessThan(recordStart);
    expect(html.match(/data-stored-close/g)).toHaveLength(1);
    expect(html).toContain("$344.63");
    expect(html).not.toContain("US$");
    expect(html.slice(closingIndex, recordStart)).toContain('href="https://api-ninjas.com"');
    const fundamentals = html.split('data-section="fundamentals"')[1].split("</section>")[0];
    expect(fundamentals.match(/<caption>/g)).toHaveLength(1);
    expect(fundamentals).toContain("$80,111,000,000");
    expect(fundamentals).not.toContain("USD");
    expect(fundamentals).not.toContain("بالقيمة الكاملة");
    expect(data).toEqual(before);
  });
  it.each(["ar", "en"] as const)("labels both stored ratio operands and never substitutes the market-cap card in %s", locale => {
    const data = uiTwoFixture();
    const criterion = data.criteria[1];
    const original = structuredClone(data);
    expect(text(render(<RatioNote criterion={criterion} locale={locale} />, locale))).toBe(locale === "ar"
      ? "الديون بفوائد $64.8B ÷ أساس القيمة السوقية $919B"
      : "Interest-bearing debt $64.8B ÷ Market value basis $919B");
    expect(text(render(<StockFigures data={data} locale={locale} />, locale))).toContain("$879B");
    data.facts = data.facts.filter(fact => fact.line_item !== "market_cap");
    const figures = text(render(<StockFigures data={data} locale={locale} />, locale));
    expect(figures).toContain("—");
    expect(figures).not.toContain("$919B");
    expect(criterion).toEqual(original.criteria[1]);
  });
  it.each([479e9, 4.64e12, null])("uses missing-figure text, not an unlabelled division by %s", denominator_value => {
    const criterion = { ...uiTwoFixture().criteria[1], numerator_value: null, denominator_value };
    for (const locale of ["ar", "en"] as const) expect(text(render(<RatioNote criterion={criterion} locale={locale} />, locale)))
      .toBe(locale === "ar" ? "الرقم غير متاح" : "Figure unavailable");
  });
  it("retains zeros, scales units only for presentation and preserves non-USD/count evidence", () => {
    const fact = uiTwoFixture().facts[1];
    expect(text(render(<FundamentalValue fact={{ ...fact, value: 80_111, unit_scale: "millions" }} locale="ar" />, "ar"))).toBe("$80,111,000,000");
    expect(formatFullDollars(0)).toBe("$0");
    expect(formatFullDollars(-1234.56)).toBe("-$1,234.56");
    expect(text(render(<FundamentalValue fact={{ ...fact, value: 0 }} locale="ar" />, "ar"))).toBe("$0");
    expect(text(render(<FundamentalValue fact={{ ...fact, value: 1000, currency: "EUR" }} locale="ar" />, "ar"))).toBe("€1,000.00");
    expect(text(render(<FundamentalValue fact={{ ...fact, value: 20, currency: null }} locale="ar" />, "ar"))).toBe("20");
    expect(text(render(<FundamentalValue fact={{ ...fact, value: null }} locale="ar" />, "ar"))).toBe("—");
  });
});
