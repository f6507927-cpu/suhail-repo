import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import ar from "../src/i18n/messages/ar.json";
import en from "../src/i18n/messages/en.json";
import { StockSummary } from "../src/components/stock/StockSummary";
import { MethodologyDetail } from "../src/components/methodology/MethodologyDetail";
import { MethodologyDirectory } from "../src/components/methodology/MethodologyDirectory";
import { uiFiveMethodologyFixture } from "./fixtures/ui-five-methodology";
import { uiOneFixture } from "./fixtures/ui-one-stock";
import { uiEightStoredVersion, uiEightVersion } from "../src/i18n/approved-arabic-ui-eight";
import { publicMethodologyVersionLabel } from "../src/i18n/methodology-labels";
import { isDraftMethodologyLabel } from "../src/i18n/methodology-display";
import { displayLabel } from "../src/i18n/presentation";
import { methodologyPublicName } from "../src/i18n/methodology-public-names";

vi.mock("server-only", () => ({}));
vi.mock("../src/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
}));
vi.stubGlobal("React", React);

// D-182: exercise the actual mapping -> public cleanup -> rendered workflow.
describe("published methodology labels after D-181", () => {
  for (const locale of ["ar", "en"] as const) {
    const render = (node: React.ReactNode) => renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
        {node}
      </NextIntlClientProvider>,
    );
    it(`${locale}: removes stale mapped draft wording, retaining the caveat`, () => {
      const stock = uiOneFixture();
      stock.version!.version_label = uiEightStoredVersion;
      stock.version!.workflow_status = "approved";
      stock.version!.production_enabled = true;
      stock.run!.methodology_version_label = uiEightStoredVersion;
      const original = structuredClone(stock);
      const summary = render(<StockSummary data={stock} locale={locale} />);
      expect(summary).not.toContain(uiEightVersion[locale].short);
      expect(summary).toContain(publicMethodologyVersionLabel(uiEightVersion[locale].short));
      expect(summary).toContain(displayLabel("workflow", "approved", locale));
      expect(stock).toEqual(original);

      const data = uiFiveMethodologyFixture();
      data.documents[0]!.version.version_label = uiEightStoredVersion;
      data.documents[0]!.version.version = "1.1";
      data.documents[0]!.version.is_public = true;
      const before = structuredClone(data);
      const detail = render(<MethodologyDetail methodology={data.methodology} {...data.documents[0]!} locale={locale} />);
      expect(detail.replaceAll("&#x27;", "'")).toContain(publicMethodologyVersionLabel(uiEightVersion[locale].full));
      expect(detail).not.toContain(uiEightVersion[locale].short);
      expect(detail).toContain(displayLabel("workflow", "approved", locale));
      expect(detail).not.toContain((locale === "ar" ? ar : en).publicMethodology.draftReview);
      expect(detail).toContain((locale === "ar" ? ar : en).methodologies.inProduction);
      expect(detail).toContain(methodologyPublicName(data.methodology.name, locale)!);
      const directory = render(<MethodologyDirectory groups={[{ ...data.methodology, versions: data.documents.map(d => ({ ...d.version, methodology_id: data.methodology.id })) }]} locale={locale} />);
      expect(directory).not.toContain(uiEightVersion[locale].short);
      expect(directory).toContain(displayLabel("workflow", "approved", locale));
      expect(data).toEqual(before);
    });
    it(`${locale}: keeps an actual draft workflow and custom labels`, () => {
      const data = uiOneFixture();
      data.version!.workflow_status = "draft";
      data.version!.version_label = uiEightStoredVersion;
      const html = render(<StockSummary data={data} locale={locale} />);
      expect(html).toContain(displayLabel("workflow", "draft", locale));
      expect(publicMethodologyVersionLabel("Custom draft research")).toBe("Custom draft research");
      expect(isDraftMethodologyLabel(uiEightStoredVersion, "approved")).toBe(false);
      expect(isDraftMethodologyLabel(uiEightStoredVersion, "production")).toBe(false);
      expect(isDraftMethodologyLabel("Released", "draft")).toBe(true);
      const method = uiFiveMethodologyFixture();
      method.documents[0]!.version.workflow_status = "draft";
      const detail = render(<MethodologyDetail methodology={method.methodology} {...method.documents[0]!} locale={locale} />);
      expect(detail).toContain(displayLabel("workflow", "draft", locale));
      expect(detail).toContain((locale === "ar" ? ar : en).publicMethodology.draftReview);
    });
  }
});
