import { notFound } from "next/navigation";
export const dynamic = "force-static";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "../../../../i18n/routing";
import { palette, semanticPairs, contrast } from "../../../../lib/palette";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
} from "../../../../lib/format";
import {
  AnalystByline,
  BrandMark,
  ConfidenceNote,
  CoverageSeal,
  DemoBanner,
  Disclaimer,
  Emphasis,
  EmptyState,
  EngineStatement,
  ExampleMethodologyBanner,
  LocalizedText,
  Lockup,
  Num,
  PriceDirection,
  StatusBadge,
  SystemError,
  type StatusCode,
} from "../../../../components/foundation";
import { Button } from "../../../../components/ui/button";

export const revalidate = 900;
const statuses: StatusCode[] = [
  "passes_selected_methodology",
  "fails_selected_methodology",
  "requires_review",
  "insufficient_data",
];
export default async function Styleguide({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Development reference only: neither locale is accessible in production.
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const label = (key: string) => (
    <LocalizedText>{t(`styleguide.${key}`)}</LocalizedText>
  );
  return (
    <main id="content" className="mx-auto max-w-6xl space-y-12 px-6 py-12">
      <section className="space-y-3">
        <p className="font-mono text-xs text-muted-foreground" lang="en">
          SUHAIL / FOUNDATION / 04
        </p>
        <h1 className="text-3xl">{label("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{label("intro")}</p>
        <p className="text-sm text-muted-foreground">{label("review")}</p>
      </section>
      <section className="space-y-5">
        <h2 className="text-xl">{label("surfaces")}</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {(["dark", "light"] as const).map((surface) => (
            <section
              key={surface}
              data-testid={`surface-${surface}`}
              className={`surface-${surface} space-y-6 rounded-lg border border-border p-6`}
            >
              <h3 lang="en" className="text-sm">
                {surface === "dark" ? "Night" : "Sand"}
              </h3>
              <Lockup surface={surface} />
              <div className="flex flex-wrap items-center gap-3">
                <BrandMark surface={surface} />
                <CoverageSeal
                  covered
                  status="passes_selected_methodology"
                  surface={surface}
                />
                <p className="text-sm text-muted-foreground">{label("seal")}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {statuses.map((status) => (
                  <StatusBadge key={status} status={status} />
                ))}
              </div>
              <AnalystByline>{label("analyst")}</AnalystByline>
              <div className="flex flex-wrap gap-4">
                <PriceDirection direction="up">
                  <Num>+1.25%</Num>
                </PriceDirection>
                <PriceDirection direction="down">
                  <Num>-0.80%</Num>
                </PriceDirection>
              </div>
              <SystemError>{label("systemError")}</SystemError>
              <div className="flex flex-wrap gap-3">
                <Button>
                  <LocalizedText>{t("common.save")}</LocalizedText>
                </Button>
                <Button variant="outline">
                  <LocalizedText>{t("common.cancel")}</LocalizedText>
                </Button>
                <Button variant="destructive">
                  <LocalizedText>{t("common.delete")}</LocalizedText>
                </Button>
              </div>
            </section>
          ))}
        </div>
      </section>
      <section className="space-y-5">
        <h2 className="text-xl">{label("typography")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div
            lang="ar"
            dir="rtl"
            className="space-y-3 rounded-lg border border-border bg-card p-6"
          >
            <h3 className="text-2xl">دليلك في السوق.</h3>
            <p>
              تصف الثقة جودة البيانات الأساسية فقط. وهي ليست مقياسًا لليقين
              الديني.
            </p>
            <p>
              النسبة <Num>{formatPercent(-0.125, "ar")}</Num>
            </p>
            <p>
              <Num>{formatNumber(1234567.89, "ar")}</Num>
            </p>
            <p>
              <Num>{formatDate("2026-10-11", "ar")}</Num>
            </p>
          </div>
          <div
            lang="en"
            dir="ltr"
            className="space-y-3 rounded-lg border border-border bg-card p-6"
          >
            <h3 className="text-2xl">Your bearing in the market.</h3>
            <p>Confidence describes the quality of the underlying data only.</p>
            <p>
              <Num>{formatPercent(-0.125, "en")}</Num>
            </p>
            <p>
              <Num>{formatNumber(1234567.89, "en")}</Num>
            </p>
            <p>
              <Num>{formatDate("2026-10-11", "en")}</Num>
            </p>
          </div>
        </div>
        <p>
          {label("money")}: <Num>{formatMoney(12.5, locale, "USD", 1000)}</Num>
        </p>
        <Emphasis>{label("emphasis")}</Emphasis>
        <p className="text-sm text-muted-foreground">{label("fonts")}</p>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl">{label("components")}</h2>
        <DemoBanner />
        <ExampleMethodologyBanner />
        <EngineStatement />
        <ConfidenceNote />
        <p>
          <LocalizedText>{t("methodology.pageNote")}</LocalizedText>
        </p>
        <p>
          <LocalizedText>{t("stock.livePriceNote")}</LocalizedText>
        </p>
        <Disclaimer />
        <Disclaimer variant="full" />
        <EmptyState />
      </section>
      <section className="space-y-5">
        <h2 className="text-xl">{label("tokens")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(palette).map(([name, hex]) => (
            <div
              key={name}
              className="flex items-center gap-3 rounded-md border border-border p-3"
            >
              <span
                aria-hidden="true"
                className="size-8 shrink-0 rounded-sm border border-border"
                style={{ background: hex }}
              />
              <span lang="en" dir="ltr" className="text-xs">
                <span className="block">{name}</span>
                <Num>{hex}</Num>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-5">
        <h2 className="text-xl">{label("contrast")}</h2>
        <p className="text-sm text-muted-foreground">{label("decorative")}</p>
        <p lang="en" className="text-sm text-muted-foreground">
          Raw --muted = secondary text. shadcn bg-muted → --muted-surface. Text
          ≥4.5:1; meaningful outlines/icons ≥3:1. Decorative separators are
          exempt.
        </p>
        <div className="overflow-x-auto">
          <table lang="en" dir="ltr" className="w-full text-start text-xs">
            <caption className="pb-4 text-start">
              <LocalizedText>{t("styleguide.labels")}</LocalizedText>
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-2 text-start">
                  Mapping
                </th>
                <th scope="col" className="p-2 text-start">
                  Foreground / background
                </th>
                <th scope="col" className="p-2 text-start">
                  Ratio
                </th>
                <th scope="col" className="p-2 text-start">
                  Use
                </th>
              </tr>
            </thead>
            <tbody>
              {semanticPairs.map((pair, i) => (
                <tr key={i} className="border-b border-[var(--divider)]">
                  <td className="p-2">
                    {pair.proposal && (
                      <span className="me-2 text-[var(--byline)]">
                        PROPOSAL
                      </span>
                    )}
                    {pair.mapping}
                  </td>
                  <td className="p-2">
                    <Num>
                      {pair.foreground} / {pair.background}
                    </Num>
                  </td>
                  <td className="p-2">
                    <Num>
                      {contrast(pair.foreground, pair.background).toFixed(2)}:1
                    </Num>
                  </td>
                  <td className="p-2">
                    {pair.kind === "divider" ? "Decorative only" : pair.kind}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
