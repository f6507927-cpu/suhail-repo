import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./SiteHeader";
import { AccountIdentityControl } from "../accounts/AccountIdentityControl";
import { reviewText } from "../accounts/types";
import ar from "../../i18n/messages/ar.json";
import en from "../../i18n/messages/en.json";

vi.stubGlobal("React", React);
vi.mock("../../i18n/navigation", () => ({
  usePathname: () => "/",
  getPathname: ({ locale }: { locale: string }) => locale === "en" ? "/en" : "/",
}));

describe("D-149 single-row header and search placement", () => {
  it.each(["ar", "en"] as const)("%s has one account/theme control and only existing navigation destinations", locale => {
    const messages = locale === "ar" ? ar : en;
    const props = {
      locale, messages, timeZone: "Asia/Riyadh", children: createElement(SiteHeader, {
        locale,
        labels: { appName: messages.app.name, menu: messages.nav.menu,
          screenStock: reviewText(locale, "Screen a stock"), methodologies: reviewText(locale, "Methodology") },
        accountControl: createElement(AccountIdentityControl, { locale, identity: null }),
      }),
    };
    const html = renderToStaticMarkup(createElement(NextIntlClientProvider, props));
    expect(html).toContain(`href="${locale === "ar" ? "/" : "/en"}#stock-query"`);
    expect(html).toContain(`href="${locale === "ar" ? "" : "/en"}/methodology"`);
    expect(html).toContain(locale === "ar" ? "افحص سهماً" : "Screen a stock");
    expect(html).toContain(locale === "ar" ? "المنهجية" : "Methodology");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("aria-controls=");
    expect(html).not.toMatch(/<form|<input|\/edition|\/picks|⟦AR-REVIEW⟧/);
    expect(html.match(/aria-pressed=/g)).toHaveLength(1);
    expect(html.match(/auth\/sign-in/g)).toHaveLength(1);
    expect(html).not.toContain("rounded-md border border-border");
  });
  it("removes header-only search code but keeps the public body search and focusable skip link", () => {
    expect(existsSync("src/components/foundation/header-search.ts")).toBe(false);
    const header = readFileSync("src/components/foundation/SiteHeader.tsx", "utf8");
    expect(header).not.toMatch(/StockSearchForm|shouldShowHeaderSearch|cookies\(|headers\(/);
    const layout = readFileSync("src/app/[locale]/(public)/layout.tsx", "utf8");
    expect(layout).toContain('href="#content"');
    expect(layout).toContain("focus:translate-y-0");
    expect(layout).not.toMatch(/cookies\(|headers\(|requireUser\(|requireRole\(/);
    expect(readFileSync("src/components/stock/StockVerdict.tsx", "utf8")).toContain('data-section="search-again"');
  });
});
