import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { isolateArabicCode } from "../src/i18n/bidi";
import { displayLabel } from "../src/i18n/presentation";
import { reviewText } from "../src/components/accounts/types";
import { LocalizedText, PublicLocalizedText } from "../src/components/foundation/shared";
import { SearchResults } from "../src/components/search/SearchResults";
import { StockSearchForm } from "../src/components/foundation/StockSearchForm";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";

vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));

function messageKeys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : messageKeys(value, path);
  });
}

describe("UX-1 founder wording and public fallback boundaries (D-144/D-150)", () => {
  it("has a string-valued Arabic counterpart for every English dictionary key", () => {
    const arabic = new Set(messageKeys(ar));
    expect(messageKeys(en).filter(key => !arabic.has(key))).toEqual([]);
  });

  it("applies every exact UX-1 table phrase through the existing approval map", () => {
    const table = readFileSync("docs/design/UX_PROMPTS.md", "utf8")
      .split("**UX-1 table:")[1].split("## UX-2")[0];
    const rows = [...table.matchAll(/^\| ([^|]+) \| ([^|]+) \|$/gm)]
      .filter(([, source]) => source !== "English (live site)" && source !== "---")
      .flatMap(([, source, arabic]) => source === "Source / Sources"
        ? [["Source", "المصدر"], ["Sources", "المصادر"]]
        : [[source, arabic]]);
    expect(rows).toHaveLength(30);
    for (const [source, arabic] of rows) {
      expect(approvedArabicCopy[source], source).toBe(isolateArabicCode(arabic));
      expect(reviewText("ar", source), source).toBe(isolateArabicCode(arabic));
      expect(reviewText("en", source), source).toBe(source);
    }
    expect(ar.publicSearch.title).toBe("البحث عن سهم");
    expect(ar.publicSearch.methodologyLine).toBe("اقرأ كيف نطبّق منهجية الفحص.");
    // D-130 is a separate missing-input label, not the new "Unavailable" phrase.
    expect(displayLabel("inputState", "missing", "ar")).toBe("غير متوفرة");
    expect(reviewText("ar", "Unavailable")).toBe("غير متوفر");
    expect(displayLabel("structured", "value", "ar")).toBe("القيمة");
  });

  it("suppresses the public marker without approving the phrase or changing private copy", () => {
    const source = "Unlisted English phrase";
    const pending = reviewText("ar", source);
    expect(pending).toBe(`⟦AR-REVIEW⟧ ${source}`);
    const publicHtml = renderToStaticMarkup(<PublicLocalizedText>{pending}</PublicLocalizedText>);
    expect(publicHtml).not.toContain("AR-REVIEW");
    expect(publicHtml).toContain('lang="en" dir="ltr"');
    expect(publicHtml).toContain(source);
    expect(renderToStaticMarkup(<LocalizedText>{pending}</LocalizedText>)).toContain("⟦AR-REVIEW⟧");
    expect(reviewText("ar", source)).toBe(pending);
    expect(approvedArabicCopy[source]).toBeUndefined();
  });

  it.each([true, false])("Arabic search empty state is marker-free with valid=%s", valid => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
        <StockSearchForm locale="ar" />
        <SearchResults locale="ar" valid={valid} results={[]} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("AR-REVIEW");
    expect(html).toContain("البحث عن سهم");
    expect(html).toContain(valid
      ? "No listed stocks in the screening universe match this search."
      : "Enter 1–40 characters of a ticker or company name.");
    for (const key of ["hint", "noResults", "noResultsBody"] as const)
      expect(ar.publicSearch[key]).toMatch(/^⟦AR-REVIEW⟧ /);
  });
});
