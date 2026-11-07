import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { uiOneDisplay, uiOneLabels } from "../src/i18n/approved-arabic-ui-one";
import { displayReason, visibleReasons } from "../src/stock/presentation";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { Bilingual, ReasonList, criterionExplanation } from "../src/components/stock/StockVerdictParts";
import { HomePage } from "../src/components/home/HomePage";
import { SearchResults } from "../src/components/search/SearchResults";
import { stockMetadata } from "../src/stock/metadata";
import type { StatusReason } from "../src/engine/types";
import { setUiOneStatus, uiOneFixture } from "./fixtures/ui-one-stock";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({ usePathname: () => "/", getPathname: () => "/" }));
vi.stubGlobal("React", React);

function render(node: React.ReactNode, locale: "ar" | "en") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
}
// Visible text only: attributes, script payloads and immutable fingerprints are not labels.
function text(html: string) {
  return html.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ");
}
const statuses = ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data", null] as const;
describe("D-157 UI-1 display boundary", () => {
  it("pins every exact pair independently against the founder attachment", () => {
    const attachment = readFileSync("docs/founder-approvals/Pasted-Step-UI-1-Scope-labels-only-Do-not-change-any-status-nu_1793876451123.txt", "utf8");
    const rows = attachment.split("Label table (now showing | Arabic | English):")[1].trim().split("\n");
    expect(rows).toHaveLength(26);
    for (const row of rows) {
      const [raw, arabic, english] = row.split(" | ").map(s => s.trim());
      const source = raw === "Admin (verified by)" ? "Admin" : raw === "null (limit)" ? "null" : raw === "review (effect)" ? "review" : raw;
      expect(uiOneDisplay(source, "ar"), source).toBe(arabic);
      expect(uiOneDisplay(source, "en"), source).toBe(english === "(unchanged)" ? source : english);
    }
    expect(Object.keys(uiOneLabels)).toHaveLength(rows.length);
  });
  for (const locale of ["ar", "en"] as const) {
    it.each(statuses)(`renders ${locale} stock record sections with status %s`, status => {
      const data = uiOneFixture();
      setUiOneStatus(data, status);
      const before = structuredClone(data);
      const html = render(<StockVerdict data={data} locale={locale} />, locale);
      const visible = text(html);
      expect(visible).not.toMatch(/\b[a-z]+(?:_[a-z]+)+\b/);
      expect(html).toMatch(/<details[^>]*data-section="full-record">/);
      expect(visible).toContain(status ? (locale === "ar" ? ar : en).status[status] : uiOneDisplay("No screening run recorded for this methodology yet.", locale));
      expect(html).toContain((locale === "ar" ? ar : en).disclaimer.short);
      expect(html).not.toContain("data-language-notice");
      if (status) {
        expect(html).toContain("a".repeat(64));
        expect(visible).toContain(locale === "ar" ? "الإصدار 1.0 · مسودة" : "Version 1.0 · Draft");
        expect(visible).not.toContain(locale === "ar" ? "موافَق عليه" : "Approved");
        expect(visible).toContain(locale === "ar" ? "تصدر هذه النتيجة عن محرك حساب ثابت، ولا يغيّرها الذكاء الاصطناعي." : "This result comes from a fixed calculation engine. AI never changes it.");
        expect(visible).toContain(locale === "ar" ? "الرقم غير متاح" : "Figure unavailable");
        expect(visible).not.toContain("1.00");
        expect(visible).not.toContain("0.00");
        expect(visible).not.toContain("not set limit");
        expect(visible).not.toContain("حد غير محدد");
      }
      expect(data).toEqual(before);
    });
    it(`keeps stock, full record, home card and metadata consistent in ${locale}`, () => {
      const data = uiOneFixture();
      const home = render(<HomePage data={{ featured: data, methodology: null, editorPick: null }} locale={locale} />, locale);
      expect(text(home)).toContain(uiOneDisplay("Prohibited primary business activity", locale));
      expect(text(home)).not.toContain("1.00");
      const card = home.split('href="' + (locale === "en" ? "/en" : "") + '/stock/fixture"')[1].split("</a>")[0];
      expect(card.match(/role="img"/g)?.length ?? 0).toBe(1);
      const meta = stockMetadata(data, locale, "https://example.test");
      const title = `Curated Company (FIX) — ${(locale === "ar" ? ar : en).status.fails_selected_methodology} | ${locale === "ar" ? "سهيل" : "Suhail"}`;
      expect(meta.title).toEqual({ absolute: title });
      expect(meta.openGraph).toMatchObject({ title, description: meta.description });
      expect(meta.twitter).toMatchObject({ title, description: meta.description });
      expect(meta.description).toContain(uiOneDisplay(data.methodology!.name, locale));
      expect(meta.alternates?.canonical).toBe(`https://example.test${locale === "en" ? "/en" : ""}/stock/fixture`);
      data.criteria[1].denominator_value = 123;
      expect(text(render(<StockVerdict data={data} locale={locale} />, locale))).toContain(locale === "ar" ? "الرقم غير متاح" : "Figure unavailable");
      expect(data.criteria[1].denominator_value).toBe(123);
    });
  }
  it("selects numerator wording by code and preserves surrounding mapped criterion", () => {
    const reason: StatusReason = { kind: "criterion_unknown", criterionId: "income",
      label: "Prohibited income / total revenue", field: null, ratio: null, threshold: 5,
      thresholdUnit: "percent_of_total_revenue", reasonCode: "numerator_unavailable" };
    expect(displayReason(reason, "ar")).toBe("معيار الإيرادات غير المباحة إلى إجمالي الإيرادات: النتيجة غير معروفة — الرقم غير متاح، ولم نفترض أي قيمة.");
    const input = [reason, { ...reason, kind: "review_unknown" as const, field: "prohibited_income" }];
    expect(visibleReasons(input)).toEqual([reason]);
    expect(visibleReasons([...input, { ...input[1], criterionId: "debt", field: "interest_bearing_debt" }])).toHaveLength(2);
    expect(visibleReasons([{ ...reason, kind: "counts", borderlineCount: 0, unknownCount: 0 }])).toEqual([]);
    expect(visibleReasons([{ ...reason, kind: "counts", borderlineCount: 1, unknownCount: 0 }])).toHaveLength(1);
    expect(visibleReasons([{ ...reason, kind: "counts", borderlineCount: 0, unknownCount: 1 }])).toHaveLength(1);
    expect(visibleReasons([reason, { ...reason, criterionId: "other" }])).toHaveLength(2);
    const twoInputs = [...input, { ...input[1], field: "interest_bearing_debt" }];
    expect(visibleReasons(twoInputs)).toHaveLength(3);
  });
  it.each(["company", "ticker", "exchange", "source", "sentence", "paragraph"] as const)("notice eligibility for %s", field => {
    const data = uiOneFixture();
    const english = "This is a complete English sentence.";
    if (field === "company") data.company.display_name_en = english;
    if (field === "ticker") data.security.display_symbol = english;
    if (field === "exchange") data.exchange!.name = english;
    if (field === "source") data.sources[0].document_title = english;
    if (field === "sentence") data.methodology!.scope = english;
    if (field === "paragraph") data.methodology!.scope = "This paragraph explains the missing disclosure and its effect on this research result";
    const html = render(<StockVerdict data={data} locale="ar" />, "ar");
    expect(html.match(/data-language-notice=/g)?.length ?? 0).toBe(["sentence", "paragraph"].includes(field) ? 1 : 0);
  });
  it("never shows a language notice in search, including English identities", () => {
    const results = [{ slug: "fixture", ticker: "FIX", name: "An English Company", name_ar: null, display_name_en: null,
      exchange: "New York Stock Exchange", status: "requires_review" as const }];
    expect(render(<SearchResults locale="ar" results={results} valid />, "ar")).not.toContain("data-language-notice");
  });
  it("preserves unknown fallbacks, unrelated version governance and input objects", () => {
    expect(uiOneDisplay("future_stored_value", "ar")).toBe("future_stored_value");
    const data = uiOneFixture();
    data.version!.version_label = "Unrelated version";
    expect(text(render(<StockVerdict data={data} locale="en" />, "en"))).toContain("Approved");
    const unknown = { kind: "criterion_unknown", criterionId: null, label: "Distinct unmapped criterion", field: null,
      ratio: null, threshold: null, thresholdUnit: null, reasonCode: "numerator_unavailable" } satisfies StatusReason;
    expect(text(render(<ReasonList reasons={[unknown]} locale="en" />, "en"))).toContain("Distinct unmapped criterion");
  });
  it("isolates mapped Arabic as Arabic and reuses deterministic activity explanations", () => {
    expect(render(<Bilingual locale="ar" arabic={null} english="Prohibited primary business activity" />, "ar"))
      .toContain('<bdi lang="ar" dir="rtl">النشاط الرئيسي للشركة</bdi>');
    const activity = uiOneFixture().criteria[0];
    activity.explanation_ar = null;
    activity.explanation_en = null;
    expect(criterionExplanation(activity, "ar")).toBe("يندرج النشاط الرئيسي ضمن الفئات المحظورة.");
    expect(criterionExplanation(activity, "en")).toBe("The primary activity is in the prohibited categories.");
  });
});
