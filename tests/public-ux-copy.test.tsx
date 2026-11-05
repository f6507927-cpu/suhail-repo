import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { approvedArabicCopy } from "../src/i18n/approved-arabic";
import { isolateArabicCode } from "../src/i18n/bidi";
import { displayLabel } from "../src/i18n/presentation";
import { reviewText } from "../src/components/accounts/types";
import { LocalizedText, PublicLocalizedText } from "../src/components/foundation/shared";
import { MethodologyDirectory } from "../src/components/methodology/MethodologyDirectory";
import { MethodologyDetail } from "../src/components/methodology/MethodologyDetail";
import { PublicMethodologyVersions } from "../src/components/methodology/PublicMethodologyVersions";
import type { PublicMethodologyPageData } from "../src/db/methodology-public";
import { SearchResults } from "../src/components/search/SearchResults";
import { StockSearchForm } from "../src/components/foundation/StockSearchForm";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";

vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({
  usePathname: () => "/", getPathname: () => "/",
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));

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
    expect(pending).toBe(source);
    const publicHtml = renderToStaticMarkup(<PublicLocalizedText>{pending}</PublicLocalizedText>);
    expect(publicHtml).not.toContain("AR-REVIEW");
    expect(publicHtml).toContain('lang="en" dir="ltr"');
    expect(publicHtml).toContain(source);
    expect(renderToStaticMarkup(<LocalizedText>{pending}</LocalizedText>)).not.toContain("⟦");
    expect(reviewText("ar", source)).toBe(pending);
    expect(approvedArabicCopy[source]).toBeUndefined();
  });

  it.each([true, false])("Arabic search empty state is marker-free with valid=%s", valid => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
        <StockSearchForm locale="ar" />
        <SearchResults locale="ar" valid={valid} results={[]} coverage={{ count: 25, screened: [] }} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("AR-REVIEW");
    expect(html).toContain("البحث عن سهم");
    expect(html).toContain(valid
      ? "لا نغطي هذا السهم بعد."
      : "اكتب من حرف إلى 40 حرفاً من رمز السهم أو اسم الشركة.");
    expect(ar.publicSearch.noResults).toBe("لا نغطي هذا السهم بعد.");
    for (const key of ["hint", "noResultsBody"] as const)
      expect(ar.publicSearch[key]).not.toContain("⟦");
  });

  it.each(["ar", "en"] as const)("%s search rows do not repeat language notices or suppress identifiers", locale => {
    const results = ["AAPL", "FXT"].map(ticker => ({
      slug: ticker.toLowerCase(), ticker, name: "English company", name_ar: null, display_name_en: null,
      exchange: "NYSE", status: null, covered: false,
    }));
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
        <SearchResults locale={locale} valid results={results} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("AR-REVIEW");
    // D-157: search never displays the English-only notice, including identity fallbacks.
    expect(html.match(/data-language-notice=/g) ?? []).toHaveLength(0);
    expect(html).not.toContain('data-section="header"');
    for (const code of ["AAPL", "FXT", "NYSE"]) expect(html).toContain(code);
  });

  it.each(["ar", "en"] as const)("%s methodology public boundaries suppress markers and remove decorative labels only", locale => {
    const pending = "⟦AR-REVIEW⟧ Stored research text";
    const method: PublicMethodologyPageData["methodology"] = {
      id: "method", slug: "method", name: pending, short_label: pending, type: "equity_screening",
      publisher: pending, source_title: pending, source_url: null, official_or_inspired: "adapted",
      licensing_status: "unlicensed_adapted", verified_by: pending, verification_date: null,
      production_enabled: false, scope: pending, current_version_label: pending, is_demo: false,
    };
    const version: PublicMethodologyPageData["documents"][number]["version"] = {
      id: "version", version: "v1", version_label: pending, effective_date: null, changelog: pending,
      production_enabled: false, workflow_status: "draft", purification_treatment: {
        label: pending, evidence: { claim: pending },
      }, created_at: new Date("2026-01-01"), is_public: true, is_demo: false,
    };
    const criterion: PublicMethodologyPageData["documents"][number]["criteria"][number] = {
      id: "criterion", methodology_id: "method", methodology_version_id: "version", criterion_type: "custom_ratio",
      label: pending, definition: pending, formula_text: pending, numerator_definition: pending,
      explanation_ar: null, explanation_en: null,
      denominator_definition: pending, numerator_line_items: ["total_revenue"], denominator_line_items: ["total_assets"],
      threshold: 10, threshold_unit: "percent_of_total_assets", threshold_direction: "max", borderline_margin: null,
      treatment_rules: pending, treatment_rule_data: { prohibited_categories: [pending] }, edge_cases: pending,
      required_inputs: ["total_assets"], source_reference: pending, effective_date: null, sort_order: 0,
    };
    const original = structuredClone({ method, version, criterion });
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
        <MethodologyDirectory locale={locale} groups={[]} />
        <MethodologyDirectory locale={locale} groups={[{ ...method, versions: [{ ...version, methodology_id: method.id }] }]} />
        <PublicMethodologyVersions defaultVersion="v1" versions={[{ value: "v1", label: pending }]}>
          <MethodologyDetail locale={locale} methodology={method} version={version} criteria={[criterion]} />
        </PublicMethodologyVersions>
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("AR-REVIEW");
    for (const label of ["PUBLIC RESEARCH / DOCUMENTATION", "RESEARCH REGISTER", "RULE REGISTER", "STORED METHODOLOGY DATA"])
      expect(html).not.toContain(label);
    expect(html).toContain("Stored research text");
    expect(html).toContain(locale === "ar" ? ar.methodologies.ruleGroups : en.methodologies.ruleGroups);
    expect(html).not.toContain("data-language-notice");
    expect({ method, version, criterion }).toEqual(original);
  });
});
