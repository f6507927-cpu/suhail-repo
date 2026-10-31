import { getTranslations, setRequestLocale } from "next-intl/server";
import { searchPublicStocks, searchQuery } from "../../../../db/search-public";
import { StockSearchForm } from "../../../../components/foundation/StockSearchForm";
import { SearchResults } from "../../../../components/search/SearchResults";
import { LocalizedText } from "../../../../components/foundation";

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
  const results = await searchPublicStocks(q);
  return (
    <main id="content" className="mx-auto min-h-[45vh] max-w-6xl px-6 py-14">
      <h1 className="mb-6 text-3xl"><LocalizedText>{t("title")}</LocalizedText></h1>
      <StockSearchForm locale={locale} query={query ?? ""} />
      <SearchResults results={results} locale={locale} valid={query !== null} />
    </main>
  );
}
