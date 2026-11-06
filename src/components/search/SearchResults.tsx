import { useTranslations } from "next-intl";
import { EmptyState, StatusBadge, PublicLocalizedText as LocalizedText } from "../foundation";
import { Bilingual } from "../stock/StockVerdictParts";
import { englishCompanyName, formatNumber } from "../../lib/format";
import type { SearchCoverage, SearchResult } from "../../db/search-public";
import { StockRequestAction } from "./StockRequestAction";
import { TickerMonogram } from "../foundation/TickerMonogram";

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
    const coverageMessage = coverage.screened.length
      ? t.rich("coverageCount", {
          count: coverage.count,
          total: formatNumber(coverage.count, locale, { maximumFractionDigits: 0 }),
          number: chunks => <bdi dir="ltr" className="font-mono tabular-nums">{chunks}</bdi>,
        })
      : t.rich("coverageSummary", {
          count: coverage.count,
          total: formatNumber(coverage.count, locale, { maximumFractionDigits: 0 }),
          number: chunks => <bdi dir="ltr" className="font-mono tabular-nums">{chunks}</bdi>,
        });
    return (
      <section className="mt-8" data-search-no-coverage>
        <h2 className="text-lg"><LocalizedText>{t("noResults")}</LocalizedText></h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {coverageMessage}
        </p>
        {coverage.screened.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={t("examplesLabel")}>
            {coverage.screened.slice(0, 5).map(stock => (
              <li key={stock.slug}>
                <a href={`${prefix}/stock/${stock.slug}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 underline underline-offset-4">
                  <bdi dir="ltr" className="font-mono tabular-nums">{stock.ticker}</bdi>
                </a>
              </li>
            ))}
          </ul>
        )}
        <div data-stock-request-slot>{query ? <StockRequestAction locale={locale} query={query} /> : null}</div>
      </section>
    );
  }
  return (
    <div className="mt-8">
      <p className="mb-3 text-sm text-muted-foreground">
        {t.rich("resultCount", {
          count: results.length,
          total: formatNumber(results.length, locale, { maximumFractionDigits: 0 }),
          number: chunks => <bdi dir="ltr" className="font-mono tabular-nums">{chunks}</bdi>,
        })}
      </p>
      <ul className="divide-y divide-[var(--divider)]">
        {results.map(result => (
          <li key={result.slug}>
            <a
              href={`${prefix}/stock/${result.slug}`}
              className="group flex min-h-14 w-full items-center justify-between gap-4 py-3 text-inherit no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--brass)_7%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--brass)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
              <span className="grid min-w-0 gap-1">
                <span className="break-words font-medium leading-snug">
                  <Bilingual locale={locale} arabic={result.name_ar} english={englishCompanyName(result)} />
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {/* Repeat the English name only when the line above shows an Arabic name. */}
                  {locale === "ar" && result.name_ar?.trim() && <>
                    <bdi dir="ltr" lang="en" className="break-words">{englishCompanyName(result)}</bdi>
                    <span aria-hidden="true">·</span>
                  </>}
                  <bdi className="font-mono tabular-nums text-sm" dir="ltr">{result.ticker}</bdi>
                  <span aria-hidden="true">·</span>
                  <bdi dir="ltr" className="break-words">{result.exchange ?? "—"}</bdi>
                </span>
              </span>
              {/* Decorative; after the name in DOM order (D-166), shown first visually. */}
              <TickerMonogram ticker={result.ticker} size="sm" className="order-first" />
              </span>
              <span className="shrink-0">
                {result.status
                  ? <StatusBadge status={result.status} />
                  : <span className="text-sm text-muted-foreground" role="status"><LocalizedText>{t("listedPrefix")}</LocalizedText> · <LocalizedText>{t("notScreened")}</LocalizedText></span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
