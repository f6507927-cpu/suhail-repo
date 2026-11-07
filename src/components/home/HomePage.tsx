import { stockCriterionLabel } from "@/i18n/stock-labels";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { PublicHomeData } from "@/home/types";
import { reviewText } from "@/components/accounts/types";
import { CoverageSeal, Num, StatusBadge } from "@/components/foundation";
import { StockSearchForm } from "@/components/foundation/StockSearchForm";
import { englishCompanyName, formatDate, formatNumber } from "@/lib/format";
import { RatioMeter } from "../stock/StockSummary";
import { Bilingual, ReasonList, Label, isBooleanCriterion, criterionExplanation } from "../stock/StockVerdictParts";
import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";
import { stripPublicReviewMarker } from "../foundation/shared";
import styles from "./HomePage.module.css";
import { TickerMonogram } from "../foundation/TickerMonogram";
import { RecentStocks } from "./RecentStocks";

type Locale = "ar" | "en";

const outcomeStatuses = [
  "fails_selected_methodology",
  "passes_selected_methodology",
  "passes_selected_methodology",
] as const;

function ExampleOutcomes({ locale }: { locale: Locale }) {
  const items = [
    ["Did not pass screening", "We show the criterion it failed and the actual ratio against the limit."],
    ["Passed screening", "Each ratio is within its limit, with a source for every figure. Screening alone is not an investment decision."],
    ["Passed, with analyst coverage", "Published research carrying the analyst's name, credentials and views supported by figures."],
  ] as const;

  return (
    <section className={styles.outcomes} aria-labelledby="home-outcomes-title">
      <div className={styles.wrap}>
        <h2 id="home-outcomes-title">{reviewText(locale, "Three outcomes, not two.")}</h2>
        <p className={styles.sectionLead}>
          {reviewText(locale, "Most screening tools stop at pass or fail. We add a distinction that matters: a stock that passed screening and has research signed by its analyst.")}
        </p>
        <div className={styles.outcomeGrid}>
          {items.map(([title, description], index) => (
            <article className={`${styles.outcome} ${index === 2 ? styles.covered : ""}`} key={title}>
              <div className={styles.outcomeDemo}>
                <bdi className={styles.exampleCompany} lang="en" dir="ltr">Example Co.</bdi>
                <StatusBadge status={outcomeStatuses[index]} className={styles.outcomeBadge} />
                {index === 2 && (
                  <div className={styles.sealLine}>
                    <CoverageSeal covered status="passes_selected_methodology" surface="dark" />
                    <span>{reviewText(locale, "Research signed by a Suhail analyst")}</span>
                  </div>
                )}
              </div>
              <h3>{reviewText(locale, title)}</h3>
              <p>{reviewText(locale, description)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ data, locale }: { data: NonNullable<PublicHomeData["featured"]>; locale: Locale }) {
  const run = data.run;
  if (!run) return null;

  const companyName = stripPublicReviewMarker(locale === "ar" && data.company.name_ar?.trim()
    ? data.company.name_ar.trim()
    : englishCompanyName(data.company));
  const companyLang = locale === "ar" && data.company.name_ar?.trim() ? "ar" : "en";
  const criteria = [...data.criteria]
    .sort((first, second) => first.sort_order - second.sort_order)
    .slice(0, 2);
  const prefix = locale === "en" ? "/en" : "";
  const statusReasons = Array.isArray(run.status_reasons) ? run.status_reasons.slice(0, 1) : [];

  return (
    <a
      data-ux-card
      className={styles.featuredCard}
      href={`${prefix}/stock/${encodeURIComponent(data.security.slug)}`}
      aria-label={`${reviewText(locale, "Featured security on the homepage")}: ${companyName}`}
    >
      <div className={styles.featuredTop}>
        <TickerMonogram ticker={data.security.ticker} className={styles.featuredMonogram} />
        <div className={styles.featuredIdentity}>
          <bdi className={styles.featuredName} lang={companyLang} dir={companyLang === "ar" ? "rtl" : "ltr"}>
            {companyName}
          </bdi>
          <span className={styles.featuredMeta}>
            <Num>{data.security.ticker}</Num>
            {data.exchange?.code && <><span aria-hidden="true">·</span><bdi dir="ltr">{data.exchange.code}</bdi></>}
          </span>
        </div>
        <StatusBadge status={run.status} className={styles.featuredBadge} />
      </div>

      <div className={styles.reason}>
        <ReasonList reasons={statusReasons} locale={locale} passing={run.status === "passes_selected_methodology"} />
      </div>

      {criteria.length > 0 && (
        <div className={styles.ratios}>
          {criteria.map((criterion) => {
            const percentage = criterion.threshold_unit?.startsWith("percent_");
            return (
              <div className={styles.ratio} key={criterion.id}>
                <div className={styles.ratioHeading}>
                  <bdi dir="auto" className={styles.criterionLabel}>{stockCriterionLabel(criterion, locale)}</bdi>
                  {isBooleanCriterion(criterion) ? <Label family="result" value={criterion.result} locale={locale} /> : <span className={styles.ratioValues}>
                    <Num>{criterion.ratio === null ? "—" : `${formatNumber(criterion.ratio, locale,{minimumFractionDigits:percentage?2:0,maximumFractionDigits:2})}${percentage ? "%" : ""}`}</Num>
                    {criterion.threshold !== null && (
                      <span className={styles.limitText}>
                        <span aria-hidden="true"> · </span>
                        {reviewText(locale, "Limit")}{" "}
                        <Num>{`${formatNumber(criterion.threshold, locale,{minimumFractionDigits:percentage?2:0,maximumFractionDigits:2})}${percentage ? "%" : ""}`}</Num>
                      </span>
                    )}
                  </span>}
                </div>
                <RatioMeter criterion={criterion} locale={locale} />
                {isBooleanCriterion(criterion) && criterionExplanation(criterion, locale) &&
                  <p>{criterionExplanation(criterion, locale)}</p>}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.featuredFooter}>
        <span>
          {reviewText(locale, "Data date")}{" "}
          <Num>{formatDate(run.data_as_of, locale)}</Num>
        </span>
        <span className={styles.openScreening}>{reviewText(locale, "View the full screening")}</span>
      </div>
    </a>
  );
}

export function HomePage({ data, locale }: { data: PublicHomeData; locale: Locale }) {
  const t = useTranslations("publicSearch");
  const prefix = locale === "en" ? "/en" : "";
  const hasFeaturedRun = data.featured?.run ? data.featured : null;
  const methodologyLabel = data.methodology
    ? `${uiOneDisplay(data.methodology.name, locale)} · ${uiOneDisplay(data.methodology.version, locale)}`
    : reviewText(locale, "No default methodology has been set yet.");

  return (
    <main className={styles.home} id="content" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`${styles.wrap} ${styles.heroGrid} ${hasFeaturedRun ? "" : styles.heroGridSingle}`}>
          <div className={styles.heroCopy}>
            <h1 id="home-title">{reviewText(locale, "Your bearing in the market.")}</h1>
            <p className={styles.heroLead}>
              {reviewText(locale, "Enter a ticker to see its screening result under the selected methodology and the figures behind it.")}
            </p>
            <div className={styles.searchBlock}>
              <StockSearchForm locale={locale} />
              <nav className={styles.examples} aria-label={t("examplesLabel")} data-home-search-examples>
                <span>{t("examplesLabel")}</span>
                {["AAPL", "NVDA", "KO"].map((ticker) => (
                  <a
                    key={ticker}
                    href={`${prefix}/search?q=${ticker}`}
                    className={styles.exampleLink}
                  >
                    <Num>{ticker}</Num>
                  </a>
                ))}
              </nav>
              {/* Browser-only list; server HTML stays empty so this page remains static. */}
              <RecentStocks locale={locale} />
            </div>
          </div>
          {hasFeaturedRun && (
            <FeaturedCard data={hasFeaturedRun} locale={locale} />
          )}
        </div>
      </section>

      <ExampleOutcomes locale={locale} />

      <section className={styles.how} aria-labelledby="home-how-title">
        <div className={`${styles.wrap} ${styles.howGrid}`}>
          <div>
            <h2 id="home-how-title">{reviewText(locale, "From filing to result.")}</h2>
            <p className={styles.sectionLead}>
              {reviewText(locale, "A deterministic engine calculates every result. The language model only explains it and never changes it.")}
            </p>
          </div>
          <ol className={styles.steps} id="how-we-screen">
            <li>
              <h3>{reviewText(locale, "We read the official filing")}</h3>
              <p>{reviewText(locale, "Financial statements from the company's filings with the US Securities and Exchange Commission.")}</p>
              <span className={styles.sourceLine}><bdi dir="ltr">SEC EDGAR · 10-K · 10-Q</bdi></span>
            </li>
            <li>
              <h3>{reviewText(locale, "We apply published criteria")}</h3>
              <p>{reviewText(locale, "Business activity, interest-bearing debt and non-permissible revenue, each with its own limit.")}</p>
              <span className={styles.sourceLine}>
                {data.methodology ? <a
                  href={`${prefix}/methodology`}
                  aria-label={stripPublicReviewMarker(t("methodologyLine"))}
                ><bdi dir="auto">{stripPublicReviewMarker(methodologyLabel)}</bdi></a>
                  : <bdi dir="auto">{stripPublicReviewMarker(methodologyLabel)}</bdi>}
              </span>
            </li>
            <li>
              <h3>{reviewText(locale, "We show what we know and what we do not")}</h3>
              <p>{reviewText(locale, "Every ratio comes with its calculation and source. When a figure is missing, we say so without assuming it.")}</p>
              <span className={styles.sourceLine}>{reviewText(locale, "An immutable screening record")}</span>
            </li>
          </ol>
        </div>
      </section>

      {data.editorPick && <section className={styles.editorial} id="weekly-edition" aria-labelledby="home-editorial-title">
        <div className={`${styles.wrap} ${styles.editorialGrid}`}>
          <div className={styles.editorialCopy}>
            <h2 id="home-editorial-title">{reviewText(locale, "Screening is not an investment decision.")}</h2>
            <p className={styles.sectionLead}>
              {reviewText(locale, "Screening tells you what falls outside the criteria. A Suhail analyst writes each week about companies that pass, signing the research by name.")}
            </p>
            <span className={styles.editionLabel}>{reviewText(locale, "Weekly edition: Editor's Pick")}</span>
          </div>
          {data.editorPick && (
            <article data-ux-card className={styles.pick}>
              <div className={styles.pickText}>
                <span className={styles.pickKicker}>{reviewText(locale, "Weekly edition: Editor's Pick")}</span>
                <bdi
                  className={styles.pickCompany}
                  lang={locale === "ar" && data.editorPick.company_name_ar ? "ar" : "en"}
                  dir={locale === "ar" && data.editorPick.company_name_ar ? "rtl" : "ltr"}
                >
                  {stripPublicReviewMarker(locale === "ar" && data.editorPick.company_name_ar?.trim()
                    ? data.editorPick.company_name_ar
                    : data.editorPick.company_name)}
                </bdi>
                {(data.editorPick.thesis_ar || data.editorPick.thesis_en) && (
                  <p className={styles.thesis}>
                    <Bilingual locale={locale} arabic={data.editorPick.thesis_ar} english={data.editorPick.thesis_en} />
                  </p>
                )}
                {data.editorPick.published_at && (
                  <time className={styles.pickDate} dateTime={data.editorPick.published_at}>
                    <Num>{formatDate(data.editorPick.published_at, locale)}</Num>
                  </time>
                )}
                {data.editorPick.analyst && (
                  <div className={styles.author}>
                    {data.editorPick.analyst.portrait_url && (
                      <Image
                        src={data.editorPick.analyst.portrait_url}
                        alt={stripPublicReviewMarker(locale === "ar" ? data.editorPick.analyst.name_ar : data.editorPick.analyst.name_en || data.editorPick.analyst.name_ar)}
                        width={56}
                        height={56}
                        unoptimized
                        className={styles.authorPortrait}
                      />
                    )}
                    <span className={styles.authorMeta}>
                      <bdi lang={locale === "ar" || !data.editorPick.analyst.name_en ? "ar" : "en"} dir={locale === "ar" || !data.editorPick.analyst.name_en ? "rtl" : "ltr"}>
                        {stripPublicReviewMarker(locale === "ar" || !data.editorPick.analyst.name_en
                          ? data.editorPick.analyst.name_ar
                          : data.editorPick.analyst.name_en)}
                      </bdi>
                      {data.editorPick.analyst.credentials && <span><bdi dir="auto">{stripPublicReviewMarker(data.editorPick.analyst.credentials)}</bdi></span>}
                    </span>
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
      </section>}
    </main>
  );
}
