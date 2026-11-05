import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { StockSummary } from "../src/components/stock/StockSummary";
import { MethodologyDetail } from "../src/components/methodology/MethodologyDetail";
import { uiOneFixture } from "./fixtures/ui-one-stock";
import { uiTwoFixture } from "./fixtures/ui-two-stock";
import { uiOneMethodologyFixture } from "./fixtures/ui-one-methodology";
import { uiEightStoredVersion, uiEightVersion } from "../src/i18n/approved-arabic-ui-eight";
import { uiOneDisplay, stockShortVersionLabel } from "../src/i18n/approved-arabic-ui-one";
import { displayLabel } from "../src/i18n/presentation";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/", useRouter: () => ({ replace: vi.fn() }),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.stubGlobal("React", React);
function render(locale: "ar" | "en", child: React.ReactNode) {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{child}</NextIntlClientProvider>);
}
describe("D-166 phone-first stock record", () => {
  it.each(["ar", "en"] as const)("keeps %s evidence immutable in independently closed server sections", locale => {
    const data = uiTwoFixture();
    const before = structuredClone(data);
    const html = render(locale, <StockVerdict data={data} locale={locale} />);
    expect([...html.matchAll(/<details[^>]*data-record-section="([^"]+)"/g)].map(match => match[1])).toEqual([
      "screening", "known", "unknown", "methodology", "criteria", "fundamentals", "sources", "history", "metadata", "disclaimer",
    ]);
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=| |>)/);
    expect(html).toContain(data.run!.immutable_hash);
    expect(html).toContain((locale === "ar" ? ar : en).disclaimer.full);
    for (const source of data.sources) if (source.source_url) expect(html).toContain(source.source_url.replaceAll("&", "&amp;"));
    expect(html).toContain("factCellLabel");
    expect(html).toContain("factValue");
    expect(data).toEqual(before);
  });
  it.each(["ar", "en"] as const)("uses the exact %s short label and exposes the full 1.1 caveat", locale => {
    const data = uiOneFixture();
    data.version!.version = "1.1"; data.version!.version_label = uiEightStoredVersion;
    const before = structuredClone(data);
    const summary = render(locale, <StockSummary data={data} locale={locale} />);
    expect(summary).toContain(uiEightVersion[locale].short);
    expect(summary).not.toContain(uiEightVersion[locale].full);
    expect(summary).not.toContain(displayLabel("workflow", "approved", locale));
    const html = render(locale, <StockVerdict data={data} locale={locale} />);
    const escapedFull = uiEightVersion[locale].full.replaceAll("'", "&#x27;");
    expect(html).toContain(escapedFull);
    expect(html.indexOf(escapedFull)).toBeLessThan(html.indexOf('data-record-section="screening"'));
    expect(html).toContain("data-record-version");
    expect(html).toContain(displayLabel("workflow", "approved", locale));
    expect(data).toEqual(before);
    expect(uiOneDisplay(uiEightStoredVersion, locale)).toBe(uiEightVersion[locale].full);
    expect(stockShortVersionLabel("Unmapped stored label", locale)).toBe("Unmapped stored label");
    const method = uiOneMethodologyFixture();
    const document = method.documents[0];
    document.version.version = "1.1"; document.version.version_label = uiEightStoredVersion;
    const original = structuredClone(method);
    const detail = render(locale, <MethodologyDetail methodology={method.methodology} {...document} locale={locale} />);
    expect(detail).toContain(escapedFull);
    expect(detail.indexOf(escapedFull)).toBeLessThan(detail.indexOf("<details"));
    expect(method).toEqual(original);
  });
});
