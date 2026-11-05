import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { SearchResults } from "../src/components/search/SearchResults";
import { StockSearchForm } from "../src/components/foundation/StockSearchForm";
import { uiFourResults } from "./fixtures/ui-four-search";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);
function render(locale: "ar" | "en", children: React.ReactNode) {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale}
    messages={locale === "ar" ? ar : en} timeZone="UTC">{children}</NextIntlClientProvider>);
}
const visible = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&");
describe("UI-4 search presentation", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`${locale}: each result is one complete link, including not-screened`, () => {
      const results = uiFourResults();
      const original = structuredClone(results);
      const html = render(locale, <SearchResults locale={locale} valid results={results} />);
      const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1]!);
      expect(rows).toHaveLength(10);
      rows.forEach((row, index) => {
        expect(row.match(/<a\b/g)).toHaveLength(1);
        expect(row).toMatch(/^<a\b[\s\S]*<\/a>$/);
        expect(row).toContain(`href="${locale === "en" ? "/en" : ""}/stock/fixture-${index}"`);
        expect(row).toContain("min-h-14");
        expect(row).toContain("focus-visible:");
        expect(row).toContain("hover:");
        expect(row).toContain(`FIX${index}`);
        expect(row).toContain(results[index]!.exchange);
        expect(row).toContain(results[index]!.display_name_en);
        expect(row).not.toContain(results[index]!.name);
        expect(row).toContain("no-underline");
        if (results[index]!.status === null) {
          const plain = row.match(/<span\b[^>]*role="status"[^>]*>[\s\S]*?<\/span>/)?.[0];
          expect(plain).toBeDefined();
          expect(plain).not.toMatch(/border|bg-secondary|rounded/);
        }
      });
      expect(html).not.toMatch(/sm:grid-cols|grid-cols-3/);
      expect(html.indexOf(locale === "ar" ? "شركة الاختبار 0" : "Display Company 0"))
        .toBeLessThan(html.indexOf(locale === "ar" ? "Display Company 0" : "FIX0"));
      expect(visible(html)).toContain(locale === "ar" ? "10 نتائج" : "10 results");
      expect(html).not.toMatch(/[٠-٩]|⟦/);
      expect(results).toEqual(original);
    });
    it.each([0, 1, 2, 25])(`${locale}: hides the complete Try prompt with zero suggestions (%i covered)`, count => {
      const html = render(locale, <SearchResults locale={locale} valid results={[]} coverage={{ count, screened: [] }} />);
      expect(html).not.toContain(locale === "ar" ? "جرّب:" : "Try:");
      expect(html).not.toContain("<ul");
      expect(html).toContain(locale === "ar" ? ar.publicSearch.noResults : en.publicSearch.noResults);
      expect(html).toContain("data-stock-request-slot");
    });
    it(`${locale}: preserves the prompt when there is a real suggestion`, () => {
      const html = render(locale, <SearchResults locale={locale} valid results={[]} coverage={{
        count: 1, screened: [{ ticker: "FIX", slug: "fixture" }],
      }} />);
      expect(html).toContain(locale === "ar" ? "جرّب:" : "Try:");
      expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/stock/fixture"`);
    });
    it(`${locale}: uses the shared pill GET form without changing submission semantics`, () => {
      const html = render(locale, <StockSearchForm locale={locale} query="A & B" />);
      expect(html).toContain('method="get"');
      expect(html).toContain(`action="${locale === "en" ? "/en" : ""}/search"`);
      expect(html).toContain('value="A &amp; B"');
      expect(html).toContain('maxLength="40"');
      expect(html).toContain("rounded-full");
      expect(html).toContain("bg-[var(--brass)]");
      expect(html).toContain('for="stock-query"');
    });
  }
  it.each([[1, "1 نتيجة"], [2, "2 نتيجتان"], [3, "3 نتائج"], [10, "10 نتائج"], [11, "11 نتيجة"], [100, "100 نتيجة"]] as const)(
    "Arabic ICU chooses the count form for %i with Western digits", (count, text) => {
      const html = render("ar", <SearchResults locale="ar" valid results={uiFourResults(count)} />);
      expect(visible(html)).toContain(text);
      expect(html).not.toMatch(/[٠-٩]/);
    });
});
