import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { StockVerdict } from "../../src/components/stock/StockVerdict";
import { HomePage } from "../../src/components/home/HomePage";
import { SearchResults } from "../../src/components/search/SearchResults";
import { setUiOneStatus, uiOneFixture } from "../fixtures/ui-one-stock";
import ar from "../../src/i18n/messages/ar.json";
import en from "../../src/i18n/messages/en.json";
import { MethodologyDirectory } from "../../src/components/methodology/MethodologyDirectory";
import { MethodologyDetail } from "../../src/components/methodology/MethodologyDetail";
import { PublicMethodologyVersions } from "../../src/components/methodology/PublicMethodologyVersions";
import { uiOneMethodologyFixture, uiOneMethodologyGroups } from "../fixtures/ui-one-methodology";
import { uiTwoFixture } from "../fixtures/ui-two-stock";
import { uiThreeFixture } from "../fixtures/ui-three-stock";
import { uiFourResults } from "../fixtures/ui-four-search";
import { uiFiveMethodologyFixture } from "../fixtures/ui-five-methodology";
import { StockSearchForm } from "../../src/components/foundation/StockSearchForm";
import { uiEightStoredVersion } from "../../src/i18n/approved-arabic-ui-eight";

/** Local deterministic fixtures only; no database, runtime auth alias or stored run. */
export function renderFixture(path: string, locale: "ar" | "en", status: string | null) {
  const data = path.includes("ui-three") ? uiThreeFixture(status === "none" ? null
    : (["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data"].includes(status || "")
      ? status as NonNullable<ReturnType<typeof uiThreeFixture>["run"]>["status"] : "requires_review"))
    : path.includes("ui-two") ? uiTwoFixture() : uiOneFixture();
  const method = path.includes("ui-five") ? uiFiveMethodologyFixture() : uiOneMethodologyFixture();
  const document = method.documents[0];
  if (path.includes("ui-eight")) {
    if (data.version) { data.version.version = "1.1"; data.version.version_label = uiEightStoredVersion; }
    if (data.run) { data.run.methodology_version_label = uiEightStoredVersion; }
    document.version.version = "1.1";
    document.version.version_label = uiEightStoredVersion;
    if (status === "longlabel" && data.version) data.version.version_label = "UnmappedStoredVersion" + "X".repeat(128);
  }
  if (status === "none") setUiOneStatus(data, null);
  else if (status && ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data"].includes(status))
    setUiOneStatus(data, status as NonNullable<typeof data.run>["status"]);
  const node = path.includes("stock") ? <StockVerdict data={data} locale={locale}
    canonicalUrl="https://example.test/stock/fixture" />
    : path.includes("ui-four/search") ? <main><h1>{locale === "ar" ? "البحث عن سهم" : "Stock search"}</h1>
      <StockSearchForm locale={locale} query="fixture" />
      <SearchResults locale={locale} valid results={status === "empty" ? [] : uiFourResults()}
        coverage={{ count: 25, screened: [] }} />
      </main>
    : path.includes("search") ? <SearchResults locale={locale} valid results={[{
      slug: "fixture", ticker: "FIX", name: "English Company", name_ar: null, display_name_en: null,
      exchange: "NASDAQ", status: "requires_review",
    }]} />
    : /\/methodology\/fixture/.test(path) ? <PublicMethodologyVersions defaultVersion="1.0" versions={[{ value: "1.0", label: document.version.version_label! }]}>
      <MethodologyDetail methodology={method.methodology} {...document} locale={locale} />
    </PublicMethodologyVersions>
    : /\/methodology/.test(path) ? <MethodologyDirectory groups={uiOneMethodologyGroups()} locale={locale} />
    : <HomePage data={{ featured: data, methodology: null, editorPick: null }} locale={locale} />;
  return renderToStaticMarkup(<NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">{node}</NextIntlClientProvider>);
}
