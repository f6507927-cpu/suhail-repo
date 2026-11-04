import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { countPublicListedSecurities, getPublicScreenedTickers, searchPublicStocks, searchQuery } from "../src/db/search-public";
import { StockSearchForm } from "../src/components/foundation/StockSearchForm";
import { SearchResults } from "../src/components/search/SearchResults";
import { checkRegister } from "../src/lib/copy-register";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
// Vitest's JSX transform is classic; Next supplies the automatic runtime.
vi.stubGlobal("React", React);

describe("bounded public search", () => {
  it.each([undefined, null, [], ["A", "B"], "", "  \t\n", "x".repeat(41)])("refuses invalid input without accessing DB: %j", async input => {
    const execute = vi.fn();
    expect(searchQuery(input)).toBeNull();
    expect(await searchPublicStocks(input, { execute } as never)).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
  it("trims before checking both length boundaries", () => {
    expect(searchQuery(" a ")).toBe("a");
    expect(searchQuery(` ${"x".repeat(40)} `)).toHaveLength(40);
  });
  it("parameterizes user patterns and fixes the limit and latest-run ordering in SQL", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    await searchPublicStocks("x%_\\' OR 1=1", { execute } as never);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).not.toContain("OR 1=1");
    expect(query.params).toContain("x\\%\\_\\\\' OR 1=1%");
    expect(query.sql).toContain("limit 10");
    expect(query.sql).toContain("r.generated_at desc, r.created_at desc, r.id desc");
    expect(query.sql).not.toContain("hash_payload");
    expect(query.sql).toContain("regexp_replace(translate(c.name");
    expect(query.sql).toContain("c.display_name_en");
    expect(query.sql).toContain("regexp_replace(translate(c.display_name_en");
    expect(query.sql).toContain("app.public_settings");
  });
  it("does not turn outages into successful empty results", async () => {
    await expect(searchPublicStocks("ABC", { execute: vi.fn().mockRejectedValue(new Error("offline")) } as never)).rejects.toThrow("offline");
  });
  it("counts in-universe listed securities in one aggregate public query, never a list", async () => {
    const execute = vi.fn().mockResolvedValue([{ count: 25 }]);
    expect(await countPublicListedSecurities({ execute } as never)).toBe(25);
    expect(execute).toHaveBeenCalledTimes(1);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain("count(*)::int");
    expect(query.sql).toContain("app.security");
    expect(query.sql).toContain("s.in_universe = true");
    expect(query.sql).toContain("s.listing_status = 'listed'");
    expect(query.sql).not.toContain("s.ticker");
    expect(query.sql).not.toContain("record_unmet_search");
  });
  it("bounds screened suggestions to five under the same visible public default version", async () => {
    const execute = vi.fn().mockResolvedValue([{ slug: "nasdaq-aapl", ticker: "AAPL" }]);
    expect(await getPublicScreenedTickers({ execute } as never)).toEqual([{ slug: "nasdaq-aapl", ticker: "AAPL" }]);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain("limit 5");
    expect(query.sql).toContain("v.is_public = true");
    expect(query.sql).toContain("default_shariah_methodology_version_id");
    expect(query.sql).toContain("s.listing_status = 'listed'");
    expect(query.sql).not.toContain("hash_payload");
    expect(query.sql).not.toContain("record_unmet_search");
  });
  it.each([[], [{ count: -1 }], [{ count: "25" }]].map(rows => [rows]))("does not silently invent coverage when count is invalid: %j", async rows => {
    await expect(countPublicListedSecurities({ execute: vi.fn().mockResolvedValue(rows) } as never)).rejects.toThrow("Invalid public coverage count");
  });
  for (const locale of ["ar", "en"] as const) {
    const messages = locale === "ar" ? ar : en;
    const render = (child: React.ReactNode) => renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Riyadh">{child}</NextIntlClientProvider>
    );
    it(`${locale} displays curated English search names and retains the SEC fallback`, () => {
      const row = { slug: "costco", ticker: "COST", name: "COSTCO WHOLESALE CORP /NEW",
        display_name_en: "Costco Wholesale", name_ar: null, exchange: "NASDAQ", status: null };
      const html = render(<SearchResults locale={locale} valid results={[row]} />);
      expect(html).toContain("Costco Wholesale");
      expect(html).not.toContain(row.name);
      const fallback = render(<SearchResults locale={locale} valid results={[{ ...row, display_name_en: " " }]} />);
      expect(fallback).toContain(row.name);
      const bilingual = render(<SearchResults locale={locale} valid results={[{ ...row, name_ar: "شركة الاختبار" }]} />);
      expect(bilingual).toContain(locale === "ar" ? "شركة الاختبار" : "Costco Wholesale");
    });
    it(`${locale} has accessible GET forms and locale-correct result links`, () => {
      const html = render(<StockSearchForm locale={locale} />);
      expect(html).toContain(`action="${locale === "en" ? "/en" : ""}/search"`);
      expect(html.match(/method="get"/g)).toHaveLength(1);
      expect(html).toContain('for="stock-query"');
      expect(html).not.toContain("header-stock-query");
      expect(html).toContain('maxLength="40"');
      expect(html).toContain(`placeholder="${messages.publicSearch.placeholder}"`);
      expect(html).toContain('spellCheck="false"');
      expect(html).toContain('autoCapitalize="characters"');
      expect(html).toContain('enterKeyHint="search"');
      expect(html).toContain(messages.publicSearch.screenSubmit);
      expect(html).toContain("bg-[var(--brass)]");
      expect(html).toContain('aria-busy="false"');
      expect(html).not.toContain('disabled=""');
      const results = render(<SearchResults locale={locale} valid results={[
        { slug: "sample", ticker: "ABC", name: "Fixture Company", name_ar: null, display_name_en: null, exchange: "NASDAQ", status: null },
      ]} />);
      expect(results).not.toContain("<a");
      expect(results).toContain(`${messages.publicSearch.listedPrefix} · ${messages.publicSearch.notScreened}`);
      expect(results).toContain(messages.publicSearch.notScreened);
      expect(results).toContain("Fixture Company");
      const empty = render(<SearchResults locale={locale} valid results={[]} coverage={{ count: 25, screened: [{ ticker: "AAPL", slug: "nasdaq-aapl" }] }} />);
      expect(empty).toContain(messages.publicSearch.noResults.replace("⟦AR-REVIEW⟧ ", ""));
      expect(empty).toContain(`href="${locale === "en" ? "/en" : ""}/stock/nasdaq-aapl"`);
      expect(empty).toContain('data-stock-request-slot');
      expect(empty).not.toContain("⟦AR-REVIEW⟧");
    });
    it(`${locale} links screened rows and renders the existing §4.2a badge without a coverage seal`, () => {
      const html = render(<SearchResults locale={locale} valid results={[{ slug: "nasdaq-aapl", ticker: "AAPL", name: "Apple fixture", name_ar: null, display_name_en: null, exchange: "NASDAQ", status: "requires_review" }]} />);
      expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/stock/nasdaq-aapl"`);
      expect(html).toContain(messages.status.requires_review);
      expect(html).toContain("status-review");
      expect(html).toContain('stroke-width="1.6"');
      expect(html).not.toContain("coverage-seal");
    });
    it(`${locale} caps no-match links at five and isolates Western count digits`, () => {
      const screened = Array.from({ length: 7 }, (_, i) => ({ slug: `screened-${i}`, ticker: `T${i}` }));
      const html = render(<SearchResults locale={locale} valid results={[]} coverage={{ count: 25, screened }} query="zzzz" />);
      expect(html.match(/href="(?:\/en)?\/stock\//g)).toHaveLength(5);
      expect(html).toContain(`href="${locale==="en"?"/en":""}/auth/sign-in?next=`);
      expect(html).toContain('<bdi dir="ltr" class="font-mono tabular-nums">25</bdi>');
      expect(html).not.toContain("٢٥");
      expect(html).not.toContain("AR-REVIEW");
    });
    it(`${locale} renders an outage with an encoded retry link, never no-coverage copy`, () => {
      const html = render(<SearchResults locale={locale} valid results={[]} error query="A & B" />);
      expect(html).toContain(messages.publicSearch.searchUnavailable);
      expect(html).toContain(`href="${locale === "en" ? "/en" : ""}/search?q=A%20%26%20B"`);
      expect(html).not.toContain(messages.publicSearch.noResults);
      expect(html).toContain('role="alert"');
    });
    it(`${locale} new copy passes the existing register with no extra exemptions`, () => {
      for (const text of Object.values(messages.publicSearch)) {
        expect(checkRegister(text, locale)).toEqual({ ok: true, hardBans: [], warnings: [] });
        if (locale === "ar") expect(text.startsWith("⟦AR-REVIEW⟧ ") || Object.values(approvedArabicCopy).includes(text)).toBe(true);
      }
    });
  }
  it.each([[0, "0"], [1, "واحداً"], [2, "سهمين"], [3, "أسهم أمريكية"], [25, "سهماً أمريكياً"], [100, "سهم أمريكي"]] as const)("Arabic ICU handles count %s", (count, expected) => {
    const html = renderToStaticMarkup(<NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh"><SearchResults locale="ar" valid results={[]} coverage={{ count, screened: [] }} /></NextIntlClientProvider>);
    expect(html).toContain(expected);
    expect(html).not.toContain("AR-REVIEW");
  });
  it("isolates dynamic noindex search from ISR home, stock and methodology", () => {
    const root = "src/app/[locale]/(public)/";
    const search = readFileSync(`${root}search/page.tsx`, "utf8");
    expect(search).toContain('dynamic = "force-dynamic"');
    expect(search).toContain("index: false");
    expect(search).toContain("await searchParams");
    expect(search).toContain("setRequestLocale(locale)");
    for (const path of ["page.tsx", "stock/[slug]/page.tsx", "methodology/page.tsx", "methodology/[slug]/page.tsx"]) {
      const source = readFileSync(root + path, "utf8");
      expect(source).toContain('dynamic = "force-static"');
      expect(source).toContain("revalidate = 900");
    }
    expect(readFileSync(root + "layout.tsx", "utf8")).not.toContain('dynamic = "force-static"');
  });
});
