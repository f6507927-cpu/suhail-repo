import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodologyDetail } from "../src/components/methodology/MethodologyDetail";
import { MethodologyDirectory } from "../src/components/methodology/MethodologyDirectory";
import { LocalizedText, PublicLocalizedText } from "../src/components/foundation/shared";
import { methodologyDisplay, isDraftMethodologyLabel } from "../src/i18n/methodology-display";
import { uiFiveMethodologyFixture } from "./fixtures/ui-five-methodology";
import { uiOneMethodologyGroups } from "./fixtures/ui-one-methodology";
import { uiOneFixture } from "./fixtures/ui-one-stock";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.stubGlobal("React", React);
const text = (html: string) => html.replace(/<[^>]+>/g, "");
const render = (locale: "ar" | "en", node: React.ReactNode) => renderToStaticMarkup(
  <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
afterEach(() => vi.unstubAllEnvs());
describe("UI-5 methodology presentation only", () => {
  for (const locale of ["ar", "en"] as const) {
    it(`${locale}: retains complete technical evidence in closed per-criterion server HTML`, () => {
      const data = uiFiveMethodologyFixture();
      const before = structuredClone(data);
      const document = data.documents[0]!;
      const html = render(locale, <MethodologyDetail methodology={data.methodology} {...document} locale={locale} />);
      const details = [...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map(match => match[1]!);
      const technical = details.filter(detail => detail.includes((locale === "ar" ? ar : en).publicMethodology.technicalDetails));
      expect(technical).toHaveLength(3);
      expect(html).not.toMatch(/<details\b[^>]*\bopen(?:[=>\s])/);
      technical.forEach((detail, index) => {
        for (const evidence of [`Stored technical definition ${index}.`, `Stored treatment paragraph ${index}.`,
          `Stored edge case ${index}.`, `Source reference ${index}.`]) {
          expect(text(detail)).toContain(evidence);
        }
        expect(text(detail)).toContain(locale === "ar" ? "الديون بفوائد" : "Interest-bearing debt");
        expect(text(detail)).toContain(locale === "ar" ? "أساس القيمة السوقية" : "Market value basis");
        expect(text(detail)).toContain(locale === "ar" ? "التمويل التقليدي" : "Conventional finance");
        expect(text(detail)).toContain(locale === "ar" ? "الكحول" : "Alcohol");
        if (index > 0) expect(text(detail)).toContain("× 100 ≤ 30");
      });
      const closed = text(html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, ""));
      expect(closed).not.toContain("Stored technical definition");
      expect(text(html)).toContain("A stored structured treatment sentence.");
      expect(closed).not.toContain("A stored structured treatment sentence.");
      expect(closed).toContain(locale === "ar" ? "شرح عربي محفوظ للمعيار 0." : "Stored English explanation for criterion 0.");
      expect(closed).toContain((locale === "ar" ? ar : en).publicMethodology.provisionalNotice);
      expect(closed).toContain((locale === "ar" ? ar : en).publicMethodology.draftReview);
      expect(closed).toContain(locale === "ar" ? "لا ينطبق" : "Not applicable");
      expect(html).not.toContain("<table");
      expect(text(html)).not.toMatch(/\bD-\d+|interest_bearing_debt|market_value_basis|\bnull\b/);
      expect(html).toContain('href="https://example.test/source"');
      expect(html).toContain(locale === "ar" ? "فريق سهيل" : "The Suhail team");
      expect(html).not.toContain((locale === "ar" ? ar : en).methodologies.inProduction);
      expect(data).toEqual(before);
      expect(document.version.production_enabled).toBe(true);
      expect(document.version.workflow_status).toBe("approved");
    });
    it(`${locale}: non-draft production display still follows unchanged flags`, () => {
      const data = uiFiveMethodologyFixture();
      data.documents[0]!.version.version_label = "Unrelated released version";
      const html = render(locale, <MethodologyDetail methodology={data.methodology} {...data.documents[0]!} locale={locale} />);
      expect(html).toContain((locale === "ar" ? ar : en).methodologies.inProduction);
      expect(html).not.toContain((locale === "ar" ? ar : en).publicMethodology.draftReview);
    });
    it(`${locale}: hides examples in live directory only without changing records`, () => {
      const groups = uiOneMethodologyGroups();
      groups.push({ ...structuredClone(groups[0]!), id: "example", slug: "example-methodology",
        name: "Example Methodology", is_demo: true, official_or_inspired: "internal_example" });
      const before = structuredClone(groups);
      vi.stubEnv("SITE_MODE", "preview");
      const preview = render(locale, <MethodologyDirectory groups={groups} locale={locale} />);
      expect(preview).toContain("Example Methodology");
      vi.stubEnv("SITE_MODE", "live");
      const live = render(locale, <MethodologyDirectory groups={groups} locale={locale} />);
      expect(live).not.toContain("Example Methodology");
      expect(live).toContain("/methodology/fixture");
      expect(text(live)).not.toContain("↗");
      expect(groups).toEqual(before);
    });
  }
  it("one localized English-only note covers all criteria, not source titles", () => {
    const data = uiFiveMethodologyFixture();
    const document = data.documents[0]!;
    const renderDetail = () => render("ar", <MethodologyDetail methodology={data.methodology} {...document} locale="ar" />);
    expect(renderDetail().match(/data-language-notice/g)).toHaveLength(1);
    document.version.changelog = "Founder-authorized draft preparation only.";
    document.version.purification_treatment = null;
    for (const criterion of document.criteria) {
      criterion.definition = criterion.treatment_rules = criterion.edge_cases = "تعريف عربي محفوظ.";
      criterion.treatment_rule_data = null;
      criterion.source_reference = "Short source title";
    }
    data.methodology.source_title = "A long English source title with several words and a final period.";
    expect(renderDetail()).not.toContain("data-language-notice");
    document.criteria[0]!.source_reference = "This is a whole untranslated English source reference sentence.";
    expect(renderDetail().match(/data-language-notice/g)).toHaveLength(1);
  });
  it("removes public decision IDs at every text boundary but retains private audit references", () => {
    const source = "D-132: Provisional criteria (D-122/D-123); pending analyst review.";
    expect(methodologyDisplay(source, "ar")).not.toMatch(/\bD-\d+/);
    const publicHtml = render("en", <PublicLocalizedText>{source}</PublicLocalizedText>);
    const privateHtml = render("en", <LocalizedText>{source}</LocalizedText>);
    expect(publicHtml).not.toMatch(/\bD-\d+/);
    expect(privateHtml).toContain(source);
    expect(source).toBe("D-132: Provisional criteria (D-122/D-123); pending analyst review.");
  });
  it("recognizes draft wording, never inferring or overwriting workflow", () => {
    for (const label of ["Adapted research 1.0 — draft", "Adapted research 1.1 — draft; Suhail upper-bound assumption", "الإصدار 3 · مسودة"])
      expect(isDraftMethodologyLabel(label)).toBe(true);
    for (const label of ["Released", "Overdraft criterion", null, undefined]) expect(isDraftMethodologyLabel(label)).toBe(false);
  });
  it("uses no external-link arrow on the stock page's internal methodology link", () => {
    const html = render("ar", <StockVerdict data={uiOneFixture()} locale="ar" />);
    expect(html).toContain('/methodology/fixture?version=1.0#methodology-fixture-version-1.0');
    expect(text(html)).not.toContain("↗");
  });
});
