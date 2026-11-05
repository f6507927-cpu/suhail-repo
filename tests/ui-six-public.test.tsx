import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/components/home/HomePage";
import { SiteFooter } from "../src/components/foundation/SiteFooter";
import { SignInScreen } from "../src/components/accounts/AuthScreens";
import { RecoveryScreen } from "../src/components/foundation/RecoveryScreen";
import { uiOneFixture } from "./fixtures/ui-one-stock";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/", useRouter: () => ({ replace: vi.fn() }) }));
vi.stubGlobal("React", React);
function render(locale: "ar" | "en", children: React.ReactNode) {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{children}</NextIntlClientProvider>);
}
describe("UI-6 public presentation", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`${locale}: passive Example Co outcome articles have no hover-card marker`, () => {
      const html = render(locale, <HomePage data={{ featured: uiOneFixture(), methodology: null, editorPick: null }} locale={locale} />);
      const outcomes = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)].filter(match => match[2]!.includes("Example Co."));
      expect(outcomes).toHaveLength(3);
      for (const match of outcomes) {
        expect(match[1]).not.toContain("data-ux-card");
        expect(match[1]).not.toMatch(/tabindex|role="(?:button|link)"/i);
      }
    });
    it(`${locale}: footer restores decorative wordmark without changing legal disclosure`, () => {
      const html = render(locale, <SiteFooter locale={locale} />);
      expect(html).toMatch(/<div[^>]*lang="ar"[^>]*>سهيل<\/div>/);
      expect(html).toContain((locale === "ar" ? ar : en).disclaimer.short);
      expect(html).toContain((locale === "ar" ? ar : en).disclaimer.full);
      expect(html).toContain('href="#full-disclaimer"');
    });
    it(`${locale}: sign-in is one card retaining Google, next, consent links and failures`, () => {
      const html = render(locale, <SignInScreen locale={locale} next="/account" valueStatement="Existing sign-in sentence." />);
      expect(html).toContain("Existing sign-in sentence.");
      expect(html).not.toContain("01 / 01");
      expect(html).not.toMatch(/ACCOUNT ACCESS|RESEARCH, WITH ITS REASONS/);
      expect(html.match(/<form\b/g)).toHaveLength(1);
      expect(html).toContain('name="next"');
      expect(html).toContain('value="/account"');
      expect(html).toContain(`${locale === "en" ? "/en" : ""}/terms`);
      expect(html).toContain(`${locale === "en" ? "/en" : ""}/privacy`);
      expect(html).toContain('type="submit"');
      const failure = render(locale, <SignInScreen locale={locale} valueStatement="Existing sign-in sentence."
        providerError="Google sign-in could not be started. Please try again." />);
      expect(failure).toContain('role="alert"');
    });
    it(`${locale}: public 404 has a GET search, Western status code and home route`, () => {
      const html = render(locale, <RecoveryScreen locale={locale} kind="not-found" publicNotFound />);
      expect(html).toContain("404");
      expect(html).toContain('role="search"');
      expect(html).toContain('method="get"');
      expect(html).toContain(`action="${locale === "en" ? "/en" : ""}/search"`);
      expect(html).toContain(`href="${locale === "en" ? "/en" : "/"}"`);
      expect(html).toContain('maxLength="40"');
      expect(html).toContain((locale === "ar" ? ar : en).publicRecovery.backHome);
      const privateHtml = render(locale, <RecoveryScreen locale={locale} kind="not-found" />);
      expect(privateHtml).not.toContain('role="search"');
      expect(privateHtml).not.toContain("data-public-ux");
    });
  }
  it("leaves private radius mappings intact and scopes public selectors", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("--radius: 0.5rem");
    expect(css).toContain("--radius-card: 20px");
    expect(css).toContain("--radius-pill: 999px");
    expect(css).toContain("--radius-control: 12px");
    expect(css).toContain("--raise:");
    const interactions = readFileSync("src/components/foundation/PublicInteractions.css", "utf8");
    expect(interactions).not.toContain("[data-ux-card]:hover");
    expect(interactions).not.toContain("[data-ux-card]:active");
    expect(interactions).toContain("[data-public-ux]");
  });
});
