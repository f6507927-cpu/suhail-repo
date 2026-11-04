import { useTranslations } from "next-intl";
import { EmptyState, StatusBadge, PublicLocalizedText as LocalizedText } from "../foundation";
import { Bilingual, LanguageNotice } from "../stock/StockVerdictParts";
import { englishCompanyName, formatNumber } from "../../lib/format";
import type { SearchCoverage, SearchResult } from "../../db/search-public";
import { StockRequestAction } from "./StockRequestAction";

export function SearchResults({ results, locale, valid, coverage, error = false, query = "" }: {
  results: SearchResult[]; locale: "ar" | "en"; valid: boolean;
  coverage?: SearchCoverage; error?: boolean; query?: string;
}) {
  const t = useTranslations("publicSearch");
  const prefix = locale === "en" ? "/en" : "";
  if (error) return (
    <section className="mt-8" role="alert">
      <p><LocalizedText>{t("searchUnavailable")}</LocalizedText></p>
      <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`${prefix}/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}>
        <LocalizedText>{t("retry")}</LocalizedText>
      </a>
    </section>
  );
  if (!results.length && !valid) return (
    <EmptyState publicCopy title={t("title")}>
      <LocalizedText>{t("hint")}</LocalizedText>
    </EmptyState>
  );
  if (!results.length) {
    // A failed/missing aggregate is not evidence of zero coverage.
    if (!coverage) throw new Error("No-match results require public coverage");
    return (
      <section className="mt-8" data-search-no-coverage>
        <h2 className="text-lg"><LocalizedText>{t("noResults")}</LocalizedText></h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.rich("coverageCount", { count: coverage.count, total: formatNumber(coverage.count, locale, { maximumFractionDigits: 0 }),
            number: chunks => <bdi dir="ltr" className="font-mono tabular-nums">{chunks}</bdi> })}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("examplesLabel")}>
          {coverage.screened.slice(0, 5).map(stock => (
            <li key={stock.slug}>
              <a href={`${prefix}/stock/${stock.slug}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 underline underline-offset-4">
                <bdi dir="ltr" className="font-mono tabular-nums">{stock.ticker}</bdi>
              </a>
            </li>
          ))}
        </ul>
        <div data-stock-request-slot>{query ? <StockRequestAction locale={locale} query={query} /> : null}</div>
      </section>
    );
  }
  return (
    <div className="mt-8">
    <LanguageNotice locale={locale} needed={locale === "ar" && results.some(result => !result.name_ar?.trim())} />
    <ul className="divide-y divide-[var(--divider)]">
      {results.map(result => (
        <li key={result.slug} className="grid grid-cols-2 items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_14rem]">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            {result.status
              ? <a href={`${prefix}/stock/${result.slug}`} className="inline-flex min-h-11 items-center underline underline-offset-4"><Bilingual locale={locale} arabic={result.name_ar} english={englishCompanyName(result)} /></a>
              : <Bilingual locale={locale} arabic={result.name_ar} english={englishCompanyName(result)} />}
          </div>
          <bdi className="font-mono tabular-nums text-sm" dir="ltr">{result.ticker}</bdi>
          <bdi className="break-words text-sm text-muted-foreground" dir="ltr">{result.exchange ?? "—"}</bdi>
          {result.status
            ? <StatusBadge status={result.status} className="justify-self-start sm:justify-self-end" />
            : <span className="inline-flex min-h-8 items-center border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground" role="status"><LocalizedText>{t("listedPrefix")}</LocalizedText> · <LocalizedText>{t("notScreened")}</LocalizedText></span>}
        </li>
      ))}
    </ul>
    </div>
  );
}
