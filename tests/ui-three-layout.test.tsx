import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { StockSummary } from "../src/components/stock/StockSummary";
import { uiThreeFixture, uiThreeStatuses } from "./fixtures/ui-three-stock";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);
function render(node: React.ReactNode, locale: "ar" | "en") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
}
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'");
const canonicalUrl = "https://example.test/stock/fixture";

describe("UI-3 public stock hierarchy", () => {
  for (const locale of ["ar", "en"] as const) {
    it.each(uiThreeStatuses)("keeps immutable record and follow-up actions in order for %s in " + locale, status => {
      const data = uiThreeFixture(status);
      const before = structuredClone(data);
      const html = render(<StockVerdict data={data} locale={locale} canonicalUrl={canonicalUrl} />, locale);
      expect(html).toContain('data-section="full-record"');
      expect(html).toMatch(/<details[^>]*data-section="full-record">/);
      expect(html).toContain('data-section="search-again"');
      expect(html).toContain('data-section="disclaimer"');
      const header = html.split('data-section="header"')[1].split("</header>")[0];
      expect(plain(header).match(/NASDAQ/g)).toHaveLength(1);
      expect(plain(header)).toContain("National Commercial Banks");
      expect(plain(header)).not.toContain("SEC label");
      expect(plain(header)).not.toContain("تصنيف SEC");
      if (status) {
        const summaryIndex = html.indexOf('data-section="why"');
        const shareIndex = html.indexOf('data-section="share"');
        expect(shareIndex).toBeGreaterThan(summaryIndex);
        expect(shareIndex).toBeLessThan(html.indexOf('data-section="full-record"'));
        for (const section of ["screening", "known", "unknown", "methodology", "criteria", "fundamentals", "sources", "history", "metadata"])
          expect(html).toContain(`data-section="${section}"`);
        expect(html).toContain("a".repeat(64));
        expect(html).toContain('data-stored-close');
      } else {
        expect(html).not.toContain('data-section="share"');
        expect(html).not.toContain('class="font-mono tabular-nums ">—</bdi>');
        expect(html).not.toContain('data-stored-close');
        expect(html).not.toContain("$879B");
        expect(plain(html)).toContain(locale === "ar" ? "لم يُفحص هذا السهم بعد." : "This stock hasn't been screened yet.");
        expect(html).not.toContain("stock-summary-criteria-title");
        expect(plain(html)).not.toContain(locale === "ar" ? "لم يُسجَّل دليل للمعايير" : "No criterion evidence was stored for this run.");
      }
      expect(data).toEqual(before);
    });
    it("omits passing fallback reasons/empty unknown panel and uses three metadata rows in " + locale, () => {
      const html = render(<StockSummary data={uiThreeFixture("passes_selected_methodology")} locale={locale} />, locale);
      const text = plain(html);
      expect(text).not.toContain(locale === "ar" ? "لم تُسجّل أسباب إضافية" : "No additional status reasons were recorded.");
      expect(text).not.toContain(locale === "ar" ? "ما لا نعرفه" : "What we don't know");
      expect(html).toContain('data-section="summary-metadata"');
      for (const row of ["methodology", "version", "date-confidence"]) expect(html).toContain(`data-meta="${row}"`);
      expect(plain(html)).toContain("Analyst custom draft label retaining a deliberately long qualifier for layout verification");
      expect(html).toContain(locale === "ar" ? "ماذا تعني هذه النتيجة؟" : "What does this result mean?");
    });
  }
});
