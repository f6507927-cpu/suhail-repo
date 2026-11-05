import { getTranslations, setRequestLocale } from "next-intl/server";
import { countPublicListedSecurities, getPublicScreenedTickers, searchPublicStocks, searchQuery, type SearchCoverage, type SearchResult } from "../../../../db/search-public";
import { StockSearchForm } from "../../../../components/foundation/StockSearchForm";
import { SearchResults } from "../../../../components/search/SearchResults";
import { PublicLocalizedText as LocalizedText } from "../../../../components/foundation";

// D-20/D-22: query-driven SSR only here; sibling pages retain 900-second ISR.
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: true } };
export default async function SearchPage({ params, searchParams }: {
  params: Promise<{ locale: "ar" | "en" }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale); // Never fall back to next-intl request headers.
  const t = await getTranslations({ locale, namespace: "publicSearch" });
  const { q } = await searchParams;
  const query = searchQuery(q);
  let results: SearchResult[] = [];
  let coverage: SearchCoverage | undefined;
  let error = false;
  try {
    results = await searchPublicStocks(q);
    if (query && !results.length) {
      const [count, screened] = await Promise.all([countPublicListedSecurities(), getPublicScreenedTickers()]);
      coverage = { count, screened };
    }
  } catch {
    // UX-4: database failures are not successful empty searches. D-136's
    // proxy-owned 429 and D-129 copy never pass through this database catch.
    error = true;
  }
  return (
    <main id="content" className="mx-auto min-h-[45vh] max-w-6xl px-6 py-14">
      <h1 className="mb-5 text-xl font-medium tracking-tight text-muted-foreground"><LocalizedText>{t("title")}</LocalizedText></h1>
      <StockSearchForm locale={locale} query={query ?? ""} />
      <SearchResults results={results} locale={locale} valid={query !== null} coverage={coverage} error={error} query={query ?? ""} />
    </main>
  );
}
