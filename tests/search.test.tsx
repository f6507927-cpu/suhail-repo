import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { searchPublicStocks, searchQuery } from "../src/db/search-public";
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
    expect(query.sql).toContain("app.public_settings");
  });
  it("does not turn outages into successful empty results", async () => {
    await expect(searchPublicStocks("ABC", { execute: vi.fn().mockRejectedValue(new Error("offline")) } as never)).rejects.toThrow("offline");
  });
  for (const locale of ["ar", "en"] as const) {
    const messages = locale === "ar" ? ar : en;
    const render = (child: React.ReactNode) => renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Riyadh">{child}</NextIntlClientProvider>
    );
    it(`${locale} has accessible GET forms and locale-correct result links`, () => {
      const html = render(<><StockSearchForm locale={locale} /><StockSearchForm locale={locale} compact /></>);
      expect(html).toContain(`action="${locale === "en" ? "/en" : ""}/search"`);
      expect(html.match(/method="get"/g)).toHaveLength(2);
      expect(html).toContain('for="stock-query"');
      expect(html).toContain('for="header-stock-query"');
      expect(html).toContain('maxLength="40"');
      const results = render(<SearchResults locale={locale} valid results={[
        { slug: "sample", ticker: "ABC", name: "Fixture Company", name_ar: null, exchange: "NASDAQ", status: null },
      ]} />);
      expect(results).toContain(`href="${locale === "en" ? "/en" : ""}/stock/sample"`);
      expect(results).toContain(messages.publicSearch.notScreened);
      expect(results).toContain("Fixture Company");
      expect(render(<SearchResults locale={locale} valid results={[]} />)).toContain(messages.publicSearch.noResults);
    });
    it(`${locale} new copy passes the existing register with no extra exemptions`, () => {
      for (const text of Object.values(messages.publicSearch)) {
        expect(checkRegister(text, locale)).toEqual({ ok: true, hardBans: [], warnings: [] });
        if (locale === "ar") expect(text.startsWith("⟦AR-REVIEW⟧ ") || Object.values(approvedArabicCopy).includes(text)).toBe(true);
      }
    });
  }
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
