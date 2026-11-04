import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "../src/app/[locale]/(public)/search/page";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";

vi.stubGlobal("React", React);
const mocks = vi.hoisted(() => ({ search: vi.fn(), count: vi.fn(), screened: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.mock("../src/db/search-public", async importOriginal => ({
  ...await importOriginal<typeof import("../src/db/search-public")>(),
  searchPublicStocks: mocks.search, countPublicListedSecurities: mocks.count, getPublicScreenedTickers: mocks.screened,
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async ({ locale, namespace }: { locale: "ar" | "en"; namespace: "publicSearch" }) =>
    createTranslator({ locale, messages: locale === "ar" ? ar : en, namespace }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue([]);
  mocks.count.mockResolvedValue(25);
  mocks.screened.mockResolvedValue([{ slug: "nasdaq-aapl", ticker: "AAPL" }]);
});
async function html(locale: "ar" | "en", q?: string) {
  const page = await SearchPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ q }) });
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="Asia/Riyadh">{page}</NextIntlClientProvider>);
}
describe("SSR search failure and empty-state boundaries", () => {
  it("loads one count and bounded screened choices only after a valid no-match", async () => {
    expect(await html("ar", "zzzz")).toContain("لا نغطي هذا السهم بعد.");
    expect(mocks.search).toHaveBeenCalledExactlyOnceWith("zzzz");
    expect(mocks.count).toHaveBeenCalledTimes(1);
    expect(mocks.screened).toHaveBeenCalledTimes(1);
  });
  it("does not load an inventory for empty/invalid queries or matched results", async () => {
    await html("ar");
    expect(mocks.count).not.toHaveBeenCalled();
    mocks.search.mockResolvedValue([{ slug: "sample", ticker: "ABC", name: "Sample", name_ar: null, display_name_en: null, exchange: "NASDAQ", status: null }]);
    const result = await html("en", "ABC");
    expect(result).toContain("Listed · Not screened yet");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.screened).not.toHaveBeenCalled();
  });
  for (const locale of ["ar", "en"] as const) {
    it.each(["search", "count", "screened"] as const)(`${locale}: %s database failure is an error with retry, never a no-match`, async loader => {
      mocks[loader].mockRejectedValueOnce(new Error("private database detail"));
      const result = await html(locale, "zzzz");
      expect(result).toContain((locale === "ar" ? ar : en).publicSearch.searchUnavailable);
      expect(result).toContain(`href="${locale === "ar" ? "" : "/en"}/search?q=zzzz"`);
      expect(result).not.toContain("data-search-no-coverage");
      expect(result).not.toContain("private database detail");
      if (loader === "search") expect(mocks.count).not.toHaveBeenCalled();
    });
  }
});
