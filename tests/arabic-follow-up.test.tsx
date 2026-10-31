import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { displayLabel, presentationLabels } from "../src/i18n/presentation";
import { reviewText } from "../src/components/accounts/types";
import { Copy, Label } from "../src/components/stock/StockVerdictParts";
import { UnmetSearchPanel } from "../src/components/financial/UnmetSearchPanel";
import { isolateArabicCode } from "../src/i18n/bidi";
import followUp from "../src/i18n/approved-arabic-follow-up.json";
import { SearchResults } from "../src/components/search/SearchResults";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));

const source = readFileSync("tests/fixtures/arabic-follow-up-founder.txt", "utf8");
const phrases = source.split("\n").filter(line => line.includes(" = ") && !line.startsWith('"'))
  .map(line => line.split(" = ") as [string, string])
  .map(([english, arabic]) => [english, english === "CIK" ? "CIK" : arabic] as const);
const categoryLine = source.split("\n").find(line => line.startsWith("conventional_finance "))!;
const categories = categoryLine.replace(/\.$/, "").split("; ").map(value => {
  const [, key, english, arabic] = /^(\w+) (.*?) \/ (.*)$/.exec(value)!;
  return { key, english, arabic };
});

describe("D-138 bounded, independently pinned founder wording", () => {
  it("contains exactly sections 2–3 and inactive, never a blanket draft approval", () => {
    expect(phrases).toHaveLength(48);
    expect(Object.keys(followUp).sort()).toEqual([...phrases.map(([english]) => english), "inactive"].sort());
    for (const [english, arabic] of phrases) {
      expect(followUp[english as keyof typeof followUp], english).toBe(arabic);
      expect(reviewText("ar", english), english).toBe(isolateArabicCode(arabic));
      expect(reviewText("en", english), english).toBe(english);
    }
    expect(reviewText("ar", "inactive")).toBe("غير نشط");
    expect(reviewText("ar", "Manual close saved.")).toBe("⟦AR-REVIEW⟧ Manual close saved.");
    expect(reviewText("ar", "Unlisted English phrase")).toContain("⟦AR-REVIEW⟧");
  });
  for (const locale of ["ar", "en"] as const) {
    it(`${locale}: all 19 categories render exact labels, without changing enum values`, () => {
      expect(categories).toHaveLength(19);
      expect(categories.map(row => row.key).sort()).toEqual(Object.keys(presentationLabels.activity).sort());
      for (const { key, english, arabic } of categories) {
        const expected = locale === "ar" ? arabic : english;
        expect(displayLabel("activity", key, locale)).toBe(expected);
        const html = renderToStaticMarkup(<Label family="activity" value={key} locale={locale} />);
        expect(html).toBe(`<bdi>${expected}</bdi>`);
      }
      for (const family of ["activity", "inputState"] as const) {
        expect(displayLabel(family, "future_machine_key", locale)).toBe(locale === "ar" ? "تسمية غير معروفة" : "Unrecognized label");
      }
      expect(displayLabel("inputState", "estimated", locale)).toBe(locale === "ar" ? "تقديرية" : "Estimated");
    });
    it(`${locale}: shared stock copy and empty admin/search consumers retain approved wording`, () => {
      for (const [english, arabic] of phrases) {
        const html = renderToStaticMarkup(<Copy locale={locale}>{english}</Copy>);
        expect(html, english).toBe(locale === "ar" ? isolateArabicCode(arabic) : english);
      }
      const html = renderToStaticMarkup(<UnmetSearchPanel rows={[]} locale={locale} />);
      expect(html).toContain(locale === "ar" ? followUp["No unmet searches have been recorded yet."] : "No unmet searches have been recorded yet.");
      const search = renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
        <SearchResults locale={locale} valid results={[{
          slug: "fixture", ticker: "FIX", name: "Fixture", name_ar: "شركة الاختبار",
          exchange: "NASDAQ", status: null,
        }]} />
      </NextIntlClientProvider>);
      expect(search).toContain(locale === "ar" ? "لم يُفحص بعد" : "Not screened yet");
      expect(search).toContain('<bdi class="font-mono tabular-nums text-sm" dir="ltr">FIX</bdi>');
    });
  }
  it("isolates CIK once, leaves identifier spelling and interpolation untouched", () => {
    expect(reviewText("ar", "CIK")).toBe("\u2066CIK\u2069");
    expect(isolateArabicCode(reviewText("ar", "CIK"))).toBe("\u2066CIK\u2069");
    expect(reviewText("en", "CIK")).toBe("CIK");
    expect(isolateArabicCode("{CIK} {count} 0000320193")).toBe("{CIK} {count} 0000320193");
  });
  it("connects admin categories, edit input states and replay states to approved presentation", () => {
    const financial = readFileSync("src/components/financial/FinancialAdmin.tsx", "utf8");
    expect(financial).toContain('displayLabel("activity", segment.activity_category, locale)');
    expect(financial).toContain('displayLabel("activity", item, locale)');
    expect(financial).not.toContain('text(locale, segment.activity_category)');
    expect(financial).not.toContain('text(locale, "estimated")');
    expect(financial).toContain('value={state}>{displayLabel("inputState", state, locale)}');
    expect(financial).toContain('label === "CIK" ? ltr(value || "—")');
    const screening = readFileSync("src/components/financial/ScreeningControls.tsx", "utf8");
    expect(screening).toContain('map(state => displayLabel("inputState", state, locale))');
    expect(screening).not.toContain('<span lang="en" dir="ltr">{t(locale, "replay not supported for engine")}');
  });
});
