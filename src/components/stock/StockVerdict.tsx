import { stockCriterionLabel, arabicKnownReason } from "@/i18n/stock-labels";
import {
  ConfidenceNote,
  DemoBanner,
  Disclaimer,
  ExampleMethodologyBanner,
  Num,
  StatusBadge,
} from "../foundation";
import { reviewText } from "../accounts/types";
import { stripPublicReviewMarker } from "../foundation/shared";
import { englishCompanyName, formatCalendarDate, formatNumber, formatTimestamp } from "@/lib/format";
import type { PublicStockData } from "@/stock/types";
import {
  Bilingual,
  Copy,
  CriterionValue,
  CriteriaTable,
  ExplanationSlot,
  Field,
  Label,
  LanguageNotice,
  UnknownFieldLabel,
  isBooleanCriterion,
  RatioValue,
  SourceRefs,
  periodFiledDate,
  safeUrl,
  sourceFiledDate,
  sourceNumbers,
} from "./StockVerdictParts";
import styles from "./StockVerdict.module.css";
import { StoredMonthlyClose } from "./StoredMonthlyClose";
import { ApiNinjasAttribution } from "./ApiNinjasAttribution";
import { StockSearchForm } from "../foundation/StockSearchForm";
import { StockShare } from "./StockShare";
import { StockFigures, StockSummary } from "./StockSummary";
import { PublishedResearch } from "./PublishedResearch";

type Locale = "ar" | "en";
export function StockVerdict({
  data,
  locale,
  canonicalUrl,
}: {
  data: PublicStockData;
  locale: Locale;
  canonicalUrl?: string;
}) {
  const { security, company, run, methodology, version } = data;
  const englishName = englishCompanyName(company);
  const sourceIndex = sourceNumbers(data.sources);
  const versionLabel = version?.version_label || version?.version || run?.methodology_version_label;
  const methodologyName = methodology?.name
    ? <Bilingual locale={locale} arabic={null} english={methodology.name} />
    : run?.methodology_name
      ? <Bilingual locale={locale} arabic={null} english={run.methodology_name} />
      : <Copy locale={locale}>Methodology unavailable</Copy>;
  const history = [...(run ? [run] : []), ...data.priorRuns]
    .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  const needsReverseLanguageNotice = locale === "en" &&
    Boolean(data.analyst && !data.analyst.name_en && data.analyst.name_ar);
  // D-150: the English-only §11 short context always needs one aggregated Arabic notice.
  const needsArabicLanguageNotice = locale === "ar";

  return (
    <main className={styles.page} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {(security.is_demo || company.is_demo || Boolean(run?.is_demo)) && <DemoBanner className={styles.banner} />}
      {methodology?.official_or_inspired === "internal_example"
        ? <ExampleMethodologyBanner className={styles.banner} />
        : null}

      <p className={styles.introStrip} data-section="intro">
        <span><Copy locale={locale}>Suhail screens US stocks against published Shariah criteria and shows the number behind each result.</Copy></span>
        <a href={`${locale === "en" ? "/en" : ""}/#how-we-screen`}>
          <Copy locale={locale}>How we screen</Copy>
        </a>
      </p>
      <a className={styles.backLink} href={`${locale === "en" ? "/en" : ""}/search`}>
        <Copy locale={locale}>Back to search</Copy>
      </a>

      <header className={styles.companyHeader} data-section="header">
        <div className={styles.stockHead}>
          <div className={styles.companyTitle}>
            <h1 lang={locale === "ar" && company.name_ar?.trim() ? "ar" : "en"}>
              <bdi dir={locale === "ar" && company.name_ar?.trim() ? "rtl" : "ltr"}>
                {stripPublicReviewMarker(locale === "ar" && company.name_ar?.trim() ? company.name_ar.trim() : englishName)}
              </bdi>
            </h1>
            {locale === "ar" && company.name_ar?.trim() && (
              <p className={styles.arabicName} lang="en" dir="ltr">{stripPublicReviewMarker(englishName)}</p>
            )}
            <div className={styles.identityLine}>
              <span className={styles.ticker} dir="ltr">{security.display_symbol || security.ticker}</span>
              {data.exchange && (
                <span><Bilingual locale={locale} arabic={null} english={data.exchange.name} />{" "}
                  <bdi className={styles.muted} dir="ltr">({data.exchange.code})</bdi>
                </span>
              )}
              {company.sector_label && (
                <span><Copy locale={locale}>SEC label</Copy>{" "}
                  <Bilingual locale={locale} arabic={null} english={company.sector_label} />
                </span>
              )}
            </div>
          </div>
          {canonicalUrl !== undefined && <StockShare canonicalUrl={canonicalUrl} locale={locale} />}
        </div>
        <LanguageNotice locale={locale} needed={needsArabicLanguageNotice || needsReverseLanguageNotice} reverse={needsReverseLanguageNotice} />
      </header>

      <StockSummary data={data} locale={locale} />
      <StockFigures data={data} locale={locale} />

      <div className={styles.shortContext} data-section="short-context">
        <p lang="en" dir="ltr">Informational screening only — not a fatwa. Methodologies and scholarly interpretations differ. Financial analysis is not personalized investment advice.</p>
      </div>

      {/* D-147: preserve the complete evidence record in server-rendered, initially closed details. */}
      <details className={styles.fullRecord} data-section="full-record">
        <summary>
          <span className={styles.recordTitle}>
            <Copy locale={locale}>Full record</Copy>
            <span className={styles.recordSubtitle}><Copy locale={locale}>All figures, sources and the screening fingerprint</Copy></span>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className={styles.recordBody}>
          {run && (
            <>
              <section className={`${styles.section} ${styles.screening}`} data-section="screening" aria-labelledby="stock-screening-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-screening-title"><Copy locale={locale}>Screening</Copy></h2>
                </div>
                <div className={styles.screeningTop}>
                  <StatusBadge status={run.status} />
                </div>
                <dl className={styles.summaryGrid}>
                  <Field label={<Copy locale={locale}>Under</Copy>}>
                    {methodologyName}{" "}
                    <bdi className={styles.code} dir="ltr">{stripPublicReviewMarker(versionLabel ?? "")}</bdi>
                    {version?.workflow_status && <span> · <Label family="workflow" value={version.workflow_status} locale={locale} /></span>}
                  </Field>
                  <Field label={<Copy locale={locale}>Period end</Copy>}><time>{formatCalendarDate(data.period?.period_end, locale)}</time></Field>
                  <Field label={<Copy locale={locale}>Filing date</Copy>}><time>{periodFiledDate(data, locale)}</time></Field>
                  <Field label={<Copy locale={locale}>Confidence</Copy>}>
                    <Label family="confidence" value={run.confidence} locale={locale} />
                    <ConfidenceNote className={styles.note} />
                  </Field>
                  <Field label={<Copy locale={locale}>Data adequacy</Copy>}>
                    <Label family="adequacy" value={run.data_adequacy} locale={locale} />
                  </Field>
                  <Field label={<Copy locale={locale}>Data date</Copy>}>{formatCalendarDate(run.data_as_of, locale)}</Field>
                </dl>
                <a href="#stock-why-title" className={styles.whyLink}>
                  <Copy locale={locale}>Why?</Copy><span aria-hidden="true">↓</span>
                </a>
              </section>

              <section className={styles.section} data-section="known" aria-labelledby="stock-known-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-known-title"><Copy locale={locale}>What we know</Copy></h2>
                </div>
                {data.criteria.length ? (
                  <ul className={styles.evidenceList}>
                    {data.criteria.map((criterion) => (
                      <li key={criterion.id}>
                        <strong><Bilingual locale={locale} arabic={null} english={stockCriterionLabel(criterion, locale) || reviewText(locale, "Unlabelled criterion")} /></strong>
                        <dl className={styles.evidenceFields}>
                          <Field label={<Copy locale={locale}>Result</Copy>}><Label family="result" value={criterion.result} locale={locale} /></Field>
                          {!isBooleanCriterion(criterion) && <>
                            <Field label={<Copy locale={locale}>Numerator</Copy>}><CriterionValue value={criterion.numerator_value} locale={locale} compactMoney={Boolean(criterion.threshold_unit?.startsWith("percent_"))} /></Field>
                            <Field label={<Copy locale={locale}>Denominator</Copy>}><CriterionValue value={criterion.denominator_value} locale={locale} compactMoney={Boolean(criterion.threshold_unit?.startsWith("percent_"))} /></Field>
                            <Field label={<Copy locale={locale}>Ratio</Copy>}><RatioValue criterion={criterion} value={criterion.ratio} locale={locale} /></Field>
                          </>}
                        </dl>
                        <SourceRefs ids={criterion.source_ids} numbers={sourceIndex} locale={locale} />
                      </li>
                    ))}
                  </ul>
                ) : <p className={styles.muted}><Copy locale={locale}>No criterion evidence was stored for this run.</Copy></p>}
              </section>

              <section className={styles.section} data-section="unknown" aria-labelledby="stock-unknown-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-unknown-title"><Copy locale={locale}>What we don&apos;t know</Copy></h2>
                </div>
                {data.unknowns.length ? (
                  <ul className={styles.unknownList}>
                    {data.unknowns.map((unknown) => (
                      <li key={unknown.id}>
                        <h3><UnknownFieldLabel value={unknown.field_or_input} locale={locale} /></h3>
                        <dl className={styles.unknownFields}>
                          <Field label={<Copy locale={locale}>Why missing</Copy>}>
                            {unknown.why_missing
                              ? <Bilingual locale={locale} arabic={arabicKnownReason(unknown.why_missing)} english={unknown.why_missing} />
                              : <Copy locale={locale}>Not recorded</Copy>}
                          </Field>
                          <Field label={<Copy locale={locale}>Effect</Copy>}>
                            {unknown.effect
                              ? <Bilingual locale={locale} arabic={null} english={unknown.effect} />
                              : <Copy locale={locale}>Not recorded</Copy>}
                          </Field>
                          <Field label={<Copy locale={locale}>Severity</Copy>}>
                            <Label family="severity" value={unknown.severity} locale={locale} />
                          </Field>
                        </dl>
                      </li>
                    ))}
                  </ul>
                ) : <p><Copy locale={locale}>No unknown inputs were recorded for this run.</Copy></p>}
              </section>

              <section className={styles.section} data-section="methodology" aria-labelledby="stock-method-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-method-title"><Copy locale={locale}>Methodology</Copy></h2>
                </div>
                <p className={styles.methodName}>
                  {methodology?.name ? <Bilingual locale={locale} arabic={null} english={methodology.name} /> : <Copy locale={locale}>Methodology unavailable</Copy>}{" "}
                  <bdi className={styles.code} dir="ltr">{stripPublicReviewMarker(versionLabel ?? "")}</bdi>
                  {version?.workflow_status && <> · <Label family="workflow" value={version.workflow_status} locale={locale} /></>}
                </p>
                {methodology?.scope && (
                  <p className={styles.scope}><Bilingual locale={locale} arabic={null} english={methodology.scope} /></p>
                )}
                {methodology && version && (
                  <a href={`${locale === "en" ? "/en" : ""}/methodology/${encodeURIComponent(methodology.slug)}?version=${encodeURIComponent(version.version)}#methodology-${methodology.slug}-version-${encodeURIComponent(version.version)}`} className={styles.textLink}>
                    <Copy locale={locale}>Open methodology and this version</Copy><span aria-hidden="true">↗</span>
                  </a>
                )}
              </section>

              <section className={styles.section} data-section="criteria" aria-labelledby="stock-criteria-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-criteria-title"><Copy locale={locale}>Criteria</Copy></h2>
                </div>
                <CriteriaTable criteria={data.criteria} sources={sourceIndex} locale={locale} />
              </section>
              {data.explanation && <ExplanationSlot explanation={data.explanation} locale={locale} />}
            </>
          )}
          {data.publishedPick && <PublishedResearch pick={data.publishedPick} locale={locale} />}

          {/* D-04 / D-153: retain stored monthly close only as historical context, never as a live quote. */}
          <StoredMonthlyClose close={data.storedClose} locale={locale} />

          {run && <>
          <section className={styles.section} data-section="fundamentals" aria-labelledby="stock-fundamentals-title">
            <div className={styles.sectionHeading}>
              <h2 id="stock-fundamentals-title"><Copy locale={locale}>Fundamentals</Copy></h2>
            </div>
            {data.facts.length ? (
              <div className={styles.factsTableWrap}>
                <table className={styles.factsTable}>
                  <thead>
                    <tr>{["Label", "Value", "Unit", "Period", "Input state", "Confidence tier", "Source"].map((head) => (
                      <th key={head} scope="col"><Copy locale={locale}>{head}</Copy></th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.facts.map((fact) => (
                      <tr key={fact.id}>
                        <th scope="row"><Label family="lineItem" value={fact.line_item} locale={locale} /></th>
                        <td>{fact.value !== null
                          ? <Num>{formatNumber(fact.value, locale, { maximumFractionDigits: 2 })}</Num>
                          : fact.value_text
                            ? <Bilingual locale={locale} arabic={null} english={fact.value_text} />
                            : "—"}
                        </td>
                        <td><bdi dir="ltr">{fact.currency}</bdi>{" "}<Label family="scale" value={fact.unit_scale} locale={locale} /></td>
                        <td><bdi dir="ltr">{data.period?.fiscal_period_label || "—"}</bdi></td>
                        <td><Label family="inputState" value={fact.input_state} locale={locale} /></td>
                        <td><Label family="tier" value={fact.confidence_tier} locale={locale} /></td>
                        <td><SourceRefs ids={fact.source_id ? [fact.source_id] : []} numbers={sourceIndex} locale={locale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={styles.muted}><Copy locale={locale}>No current-period facts were recorded.</Copy></p>}
          </section>

          <section className={styles.section} data-section="sources" aria-labelledby="stock-sources-title">
            <div className={styles.sectionHeading}>
              <h2 id="stock-sources-title"><Copy locale={locale}>Sources</Copy></h2>
            </div>
            {data.sources.length ? (
              <ol className={styles.sourceList}>
                {data.sources.map((source, index) => {
                  const number = index + 1;
                  const title = source.document_title || source.label;
                  const url = safeUrl(source.source_url);
                  return (
                    <li id={`source-${number}`} key={source.id}>
                      <span className={styles.sourceNumber}>[<Num>{formatNumber(number, locale)}</Num>]</span>
                      <div>
                        <h3>{source.label === "API Ninjas"
                          ? <ApiNinjasAttribution />
                          : <Bilingual locale={locale} arabic={null} english={title} />}</h3>
                        <dl>
                          <Field label={<Copy locale={locale}>Type</Copy>}><Label family="sourceType" value={source.source_type} locale={locale} /></Field>
                          <Field label={<Copy locale={locale}>Accession / reference</Copy>}>
                            {source.document_reference
                              ? <bdi dir="ltr">{source.document_reference}</bdi>
                              : <bdi dir="ltr"><Copy locale={locale}>Unavailable</Copy></bdi>}
                          </Field>
                          <Field label={<Copy locale={locale}>Filed date</Copy>}><time>{sourceFiledDate(source, data, locale)}</time></Field>
                        </dl>
                        {url && (
                          <a href={url} rel="noopener noreferrer" className={styles.textLink}>
                            <Copy locale={locale}>Open source</Copy>
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <p className={styles.muted}><Copy locale={locale}>No sources were stored for this page.</Copy></p>}
          </section>

          </>}
          {run && (
            <>
              <section className={styles.section} data-section="history" aria-labelledby="stock-history-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-history-title"><Copy locale={locale}>Change history / prior runs</Copy></h2>
                </div>
                {history.length ? (
                  <ol className={styles.historyList}>
                    {history.map((item, index) => {
                      const older = history[index + 1];
                      return (
                        <li key={item.id}>
                          <time>{formatTimestamp(item.generated_at, locale, { dateStyle: "medium" })}</time>
                          {item.id === run.id && <span className={styles.currentRun}><Copy locale={locale}>Current</Copy></span>}
                          <StatusBadge status={item.status} className={styles.smallBadge} />
                          <Num>{item.immutable_hash.slice(0, 12)}</Num>
                          {older?.status === item.status && <span className={styles.unchanged}><Copy locale={locale}>Unchanged</Copy></span>}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                {!data.priorRuns.length && <p className={styles.muted}><Copy locale={locale}>No earlier run for this methodology.</Copy></p>}
              </section>
              <section className={styles.section} data-section="metadata" aria-labelledby="stock-metadata-title">
                <div className={styles.sectionHeading}>
                  <h2 id="stock-metadata-title"><Copy locale={locale}>Run metadata</Copy></h2>
                </div>
                <dl className={styles.summaryGrid}>
                  <Field label={<Copy locale={locale}>Run hash</Copy>}><Num>{run.immutable_hash}</Num></Field>
                  <Field label={<Copy locale={locale}>Generated</Copy>}>{formatTimestamp(run.generated_at, locale)}</Field>
                  <Field label={<Copy locale={locale}>Calculation version</Copy>}><bdi className={styles.code} dir="ltr">{run.calculation_version}</bdi></Field>
                  <Field label={<Copy locale={locale}>Engine version</Copy>}><bdi className={styles.code} dir="ltr">{run.engine_version}</bdi></Field>
                </dl>
                <p className={styles.appendOnly}><Copy locale={locale}>Screening runs are append-only. This record is never edited.</Copy></p>
              </section>
            </>
          )}
          <section className={styles.disclaimerSection} data-section="disclaimer">
            <Disclaimer variant="full" locale={locale} className={styles.disclaimer} />
          </section>
        </div>
      </details>

      <section className={`${styles.section} ${styles.againBlock}`} data-section="search-again">
        <h2><Copy locale={locale}>Screen another stock</Copy></h2>
        <StockSearchForm locale={locale} />
      </section>
    </main>
  );
}
