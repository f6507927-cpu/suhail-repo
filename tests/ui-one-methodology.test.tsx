import React from "react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { MethodologyDirectory } from "../src/components/methodology/MethodologyDirectory";
import { MethodologyDetail } from "../src/components/methodology/MethodologyDetail";
import { PublicMethodologyVersions } from "../src/components/methodology/PublicMethodologyVersions";
import { StockVerdict } from "../src/components/stock/StockVerdict";
import { uiOneMethodologyFixture, uiOneMethodologyGroups } from "./fixtures/ui-one-methodology";
import { uiOneFixture } from "./fixtures/ui-one-stock";
import { uiOneDisplay, uiOneProse } from "../src/i18n/approved-arabic-ui-one";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
  usePathname: () => "/", getPathname: () => "/",
}));
vi.stubGlobal("React", React);
function render(node: React.ReactNode, locale: "ar" | "en") {
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
}
describe("D-157 public methodology presentation", () => {
  it.each(["ar", "en"] as const)("maps directory, detail, verifier and selector in %s without altering inputs", locale => {
    const data = uiOneMethodologyFixture();
    const groups = uiOneMethodologyGroups();
    const before = structuredClone({ data, groups });
    const document = data.documents[0];
    const directory = render(<MethodologyDirectory groups={groups} locale={locale} />, locale);
    const detail = render(<PublicMethodologyVersions defaultVersion="1.0" versions={[{ value: "1.0", label: document.version.version_label! }]}>
      <MethodologyDetail methodology={data.methodology} version={document.version} criteria={document.criteria} locale={locale} />
    </PublicMethodologyVersions>, locale);
    for (const source of [data.methodology.name, data.methodology.scope!, data.methodology.publisher!, document.version.version_label!]) {
      // D-181: public pages use uiOneProse, which applies the founder-chosen methodology name.
      const escaped = renderToStaticMarkup(<>{uiOneProse(source, locale)}</>);
      expect(directory).toContain(escaped);
      expect(detail).toContain(escaped);
    }
    const coreName = locale === "ar" ? "منهجية سهيل الأساسية" : "Suhail core methodology";
    expect(directory).toContain(coreName);
    expect(detail).toContain(coreName);
    expect(directory).not.toContain(uiOneDisplay(data.methodology.name, locale));
    expect(directory).toContain('href="/methodology/fixture"');
    expect(detail).toContain(locale === "ar" ? "فريق سهيل" : "The Suhail team");
    expect(detail).toContain(uiOneDisplay("Founder-authorized draft preparation only.", locale));
    expect(detail).toContain(uiOneDisplay("Prohibited income / total revenue", locale));
    expect(detail).toContain('value="1.0" selected=""');
    expect(detail).toContain("methodology-fixture-version-1.0");
    expect(detail).toContain("Untranslated source identity");
    expect(detail).not.toContain("Adapted research 1.0");
    expect(detail).not.toMatch(/>prohibited_income<|>total_revenue</);
    expect({ data, groups }).toEqual(before);
    const stock = render(<StockVerdict data={uiOneFixture()} locale={locale} />, locale);
    expect(stock).toContain(coreName); // D-181 public name on the stock page
    expect(stock).toContain(`${locale === "en" ? "/en" : ""}/methodology/fixture?version=1.0#methodology-fixture-version-1.0`);
  });
  it("keeps unknown labels and explicit workflow evidence separate from the supplied draft wording", () => {
    const data = uiOneMethodologyFixture();
    data.methodology.verified_by = "Unmapped verifier";
    data.documents[0].version.workflow_status = "approved";
    const html = render(<MethodologyDetail methodology={data.methodology} {...data.documents[0]} locale="en" />, "en");
    expect(html).toContain("Unmapped verifier");
    expect(html).toContain("Approved");
    expect(html).not.toMatch(/Version 1\.0 · Draft[^<]*Approved/);
    expect(data.documents[0].version.workflow_status).toBe("approved");
  });
});
