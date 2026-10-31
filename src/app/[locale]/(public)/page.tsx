import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocalizedText } from "../../../components/foundation";
import { StockSearchForm } from "../../../components/foundation/StockSearchForm";

export const revalidate = 900;
export const dynamic = "force-static";
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <main id="content" className="mx-auto min-h-[45vh] max-w-6xl px-6 py-14">
      <h1 className="text-3xl">{t("app.tagline")}</h1>
      <div className="mt-8">
        <StockSearchForm locale={locale === "en" ? "en" : "ar"} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        <a href={locale === "en" ? "/en/methodology" : "/methodology"} className="underline underline-offset-4">
          <LocalizedText>{t("publicSearch.methodologyLine")}</LocalizedText>
        </a>
      </p>
    </main>
  );
}
