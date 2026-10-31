import { useTranslations } from "next-intl";
import { EmptyState, StatusBadge, LocalizedText } from "../foundation";
import { Bilingual, LanguageNotice } from "../stock/StockVerdictParts";
import type { SearchResult } from "../../db/search-public";

export function SearchResults({ results, locale, valid }: {
  results: SearchResult[]; locale: "ar" | "en"; valid: boolean;
}) {
  const t = useTranslations("publicSearch");
  if (!results.length) return (
    <EmptyState title={t(valid ? "noResults" : "title")}>
      <LocalizedText>{t(valid ? "noResultsBody" : "hint")}</LocalizedText>
    </EmptyState>
  );
  return (
    <div className="mt-8">
    <LanguageNotice locale={locale} needed={locale === "ar" && results.some(result => !result.name_ar?.trim())} />
    <ul className="divide-y divide-[var(--divider)]">
      {results.map(result => (
        <li key={result.slug} className="grid grid-cols-2 items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_14rem]">
          <a href={`${locale === "en" ? "/en" : ""}/stock/${result.slug}`} className="col-span-2 min-w-0 underline underline-offset-4 sm:col-span-1">
            <Bilingual locale={locale} arabic={result.name_ar} english={result.name} />
          </a>
          <bdi className="font-mono tabular-nums text-sm" dir="ltr">{result.ticker}</bdi>
          <bdi className="break-words text-sm text-muted-foreground" dir="ltr">{result.exchange ?? "—"}</bdi>
          {result.status
            ? <StatusBadge status={result.status} className="justify-self-start sm:justify-self-end" />
            : <span className="inline-flex min-h-8 items-center border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground" role="status"><LocalizedText>{t("notScreened")}</LocalizedText></span>}
        </li>
      ))}
    </ul>
    </div>
  );
}
