import { stockCriterionLabel, arabicKnownReason, stockUnknownEffect } from "@/i18n/stock-labels";
import { publicMethodologyVersionLabel } from "@/i18n/methodology-labels";
import { stockEnglishOnlySections } from "./stock-language";
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
import { englishCompanyName, formatNumber } from "@/lib/format";
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
import { StockDate } from "./StockDate";
import { FundamentalValue } from "./FundamentalValue";
import { fundamentalsCaption } from "@/i18n/approved-arabic-ui-two";
import { ApiNinjasAttribution } from "./ApiNinjasAttribution";
import { StockSearchForm } from "../foundation/StockSearchForm";
import { StockShare } from "./StockShare";
import { StockFigures, StockSummary } from "./StockSummary";
import { PublishedResearch } from "./PublishedResearch";
import { StockRecordSection } from "./StockRecordSection";
import arMessages from "@/i18n/messages/ar.json";
import enMessages from "@/i18n/messages/en.json";

import { isSuppliedDraft, uiOneDisplay } from "@/i18n/approved-arabic-ui-one";

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
  const storedVersionLabel = version?.version_label || version?.version || run?.methodology_version_label;
  const versionLabel = publicMethodologyVersionLabel(uiOneDisplay(storedVersionLabel || "", locale));
  const methodologyName = methodology?.name
    ? <Bilingual locale={locale} arabic={null} english={methodology.name} />
    : run?.methodology_name
      ? <Bilingual locale={locale} arabic={null} english={run.methodology_name} />
      : <Copy locale={locale}>Methodology unavailable</Copy>;
  const history = [...(run ? [run] : []), ...data.priorRuns]
    .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  const needsReverseLanguageNotice = locale === "en" &&
    Boolean(data.analyst && !data.analyst.name_en && data.analyst.name_ar);
  const englishSections = locale === "ar" ? stockEnglishOnlySections(data) : [];

  return (
    <main className={styles.page} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {(security.is_demo || company.is_demo || Boolean(run?.is_demo)) && <DemoBanner className={styles.banner} />}
      {methodology?.official_or_inspired === "internal_example"
        ? <ExampleMethodologyBanner className={styles.banner} />
        : null}

      <p className={styles.introStrip} data-section="intro">
        <a href={`${locale === "en" ? "/en" : ""}/#how-we-screen`}>
          <Copy locale={locale}>How we screen</Copy>
        </a>
      </p>

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
            <div className={styles.identityLine} dir="ltr">
              <span className={styles.ticker} dir="ltr">{security.display_symbol || security.ticker}</span>
              {data.exchange && (
                <>
                  <span aria-hidden="true">·</span>
                  <bdi dir="ltr">{data.exchange.code}</bdi>
                </>
              )}
              {company.sector_label && (
                <>
                  <span aria-hidden="true">·</span>
                  <span title={locale === "ar" ? "تصنيف SEC" : "SEC label"}>
                    <Bilingual locale={locale} arabic={null} english={company.sector_label} />
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <LanguageNotice locale={locale} needed={englishSections.length > 0 || needsReverseLanguageNotice}
          reverse={needsReverseLanguageNotice} sections={needsReverseLanguageNotice ? ["Coverage by"] : englishSections} />
      </header>

      <StockSummary data={data} locale={locale} />
      {run && canonicalUrl !== undefined && <StockShare canonicalUrl={canonicalUrl} locale={locale} />}
      {run && <StockFigures data={data} locale={locale} />}

      <div className={styles.shortContext} data-section="short-context">
        <Disclaimer variant="short" locale={locale} />
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
          {versionLabel && <p className={styles.versionLabel} data-record-version lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{versionLabel}</p>}
          {run && (
            <>
              <StockRecordSection sectionKey="screening" id="stock-screening-title" title={<Copy locale={locale}>Screening</Copy>} className={styles.screening}>
                <div className={styles.screeningTop}>
                  <StatusBadge status={run.status} />
                </div>
                <dl className={styles.summaryGrid}>
                  <Field label={<Copy locale={locale}>Under</Copy>}>
                    {methodologyName}{" "}
                    <span className={styles.versionLabel} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{stripPublicReviewMarker(versionLabel ?? "")}</span>
                    {version?.workflow_status && !isSuppliedDraft(storedVersionLabel) && <span> · <Label family="workflow" value={version.workflow_status} locale={locale} /></span>}
                  </Field>
                  {version?.workflow_status && storedVersionLabel === "Adapted research 1.1 — draft; Suhail upper-bound assumption" && (
                    <Field label={locale === "ar" ? arMessages.publicMethodology.workflowStatus : enMessages.publicMethodology.workflowStatus}>
                      <Label family="workflow" value={version.workflow_status} locale={locale} />
                    </Field>
                  )}
                  <Field label={<Copy locale={locale}>Period end</Copy>}><StockDate value={data.period?.period_end} locale={locale} /></Field>
                  <Field label={<Copy locale={locale}>Filing date</Copy>}>{data.period?.source_id && data.period.reported_date
                    ? <StockDate value={data.period.reported_date} locale={locale} />
                    : periodFiledDate(data, locale)}</Field>
                  <Field label={<Copy locale={locale}>Confidence</Copy>}>
                    <Label family="confidence" value={run.confidence} locale={locale} />
                    <ConfidenceNote className={styles.note} />
                  </Field>
                  <Field label={<Copy locale={locale}>Data adequacy</Copy>}>
                    <Label family="adequacy" value={run.data_adequacy} locale={locale} />
                  </Field>
                  <Field label={<Copy locale={locale}>Data date</Copy>}><StockDate value={run.data_as_of} locale={locale} /></Field>
                </dl>
                <a href="#stock-why-title" className={styles.whyLink}>
                  <Copy locale={locale}>Why?</Copy><span aria-hidden="true">↓</span>
                </a>
              </StockRecordSection>

              <StockRecordSection sectionKey="known" id="stock-known-title" title={<Copy locale={locale}>What we know</Copy>}>
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
              </StockRecordSection>

              <StockRecordSection sectionKey="unknown" id="stock-unknown-title" title={<Copy locale={locale}>What we don&apos;t know</Copy>}>
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
                              ? <Bilingual locale={locale} arabic={null} english={stockUnknownEffect(unknown.effect, locale)} />
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
              </StockRecordSection>

              <StockRecordSection sectionKey="methodology" id="stock-method-title" title={<Copy locale={locale}>Methodology</Copy>}>
                <p className={styles.methodName}>
                  {methodology?.name ? <Bilingual locale={locale} arabic={null} english={methodology.name} /> : <Copy locale={locale}>Methodology unavailable</Copy>}{" "}
                  <span className={styles.versionLabel} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{stripPublicReviewMarker(versionLabel ?? "")}</span>
                  {version?.workflow_status && !isSuppliedDraft(storedVersionLabel) && <> · <Label family="workflow" value={version.workflow_status} locale={locale} /></>}
                </p>
                {methodology?.scope && (
                  <p className={styles.scope}><Bilingual locale={locale} arabic={null} english={methodology.scope} /></p>
                )}
                {methodology && version && (
                  <a href={`${locale === "en" ? "/en" : ""}/methodology/${encodeURIComponent(methodology.slug)}?version=${encodeURIComponent(version.version)}#methodology-${methodology.slug}-version-${encodeURIComponent(version.version)}`} className={styles.textLink}>
                    <Copy locale={locale}>Open methodology and this version</Copy>
                  </a>
                )}
              </StockRecordSection>

              <StockRecordSection sectionKey="criteria" id="stock-criteria-title" title={<Copy locale={locale}>Criteria</Copy>}>
                <CriteriaTable criteria={data.criteria} sources={sourceIndex} locale={locale} />
              </StockRecordSection>
              {data.explanation && <ExplanationSlot explanation={data.explanation} locale={locale} />}
            </>
          )}
          {data.publishedPick && <PublishedResearch pick={data.publishedPick} locale={locale} />}

          {run && <>
          <StockRecordSection sectionKey="fundamentals" id="stock-fundamentals-title" title={<Copy locale={locale}>Fundamentals</Copy>}>
            {data.facts.length ? (
              <div className={styles.factsTableWrap}>
                <table className={styles.factsTable}>
                  <caption>{fundamentalsCaption[locale]}</caption>
                  <thead>
                    <tr>{["Label", "Value", "Period", "Input state", "Confidence tier", "Source"].map((head) => (
                      <th key={head} scope="col"><Copy locale={locale}>{head}</Copy></th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.facts.map((fact) => (
                      <tr key={fact.id}>
                        <th scope="row"><Label family="lineItem" value={fact.line_item} locale={locale} /></th>
                        <td className={styles.factValue}><FundamentalValue fact={fact} locale={locale} /></td>
                        <td className={styles.factMeta}><span className={styles.factCellLabel}><Copy locale={locale}>Period</Copy></span><bdi dir="ltr">{data.period?.fiscal_period_label || "—"}</bdi></td>
                        <td className={styles.factMeta}><span className={styles.factCellLabel}><Copy locale={locale}>Input state</Copy></span><Label family="inputState" value={fact.input_state} locale={locale} /></td>
                        <td className={styles.factMeta}><span className={styles.factCellLabel}><Copy locale={locale}>Confidence tier</Copy></span><Label family="tier" value={fact.confidence_tier} locale={locale} /></td>
                        <td className={styles.factMeta}><span className={styles.factCellLabel}><Copy locale={locale}>Source</Copy></span><SourceRefs ids={fact.source_id ? [fact.source_id] : []} numbers={sourceIndex} locale={locale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={styles.muted}><Copy locale={locale}>No current-period facts were recorded.</Copy></p>}
          </StockRecordSection>

          <StockRecordSection sectionKey="sources" id="stock-sources-title" title={<Copy locale={locale}>Sources</Copy>}>
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
                          ? <ApiNinjasAttribution locale={locale} />
                          : <Bilingual locale={locale} arabic={null} english={title} />}</h3>
                        <dl>
                          <Field label={<Copy locale={locale}>Type</Copy>}><Label family="sourceType" value={source.source_type} locale={locale} /></Field>
                          <Field label={<Copy locale={locale}>Accession / reference</Copy>}>
                            {source.document_reference
                              ? <bdi dir="ltr">{source.document_reference}</bdi>
                              : <bdi dir="ltr"><Copy locale={locale}>Unavailable</Copy></bdi>}
                          </Field>
                          <Field label={<Copy locale={locale}>Filed date</Copy>}>{data.period?.source_id === source.id && data.period.reported_date
                            ? <StockDate value={data.period.reported_date} locale={locale} />
                            : sourceFiledDate(source, data, locale)}</Field>
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
          </StockRecordSection>

          </>}
          {run && (
            <>
              <StockRecordSection sectionKey="history" id="stock-history-title" title={<Copy locale={locale}>Change history / prior runs</Copy>}>
                {history.length ? (
                  <ol className={styles.historyList}>
                    {history.map((item, index) => {
                      const older = history[index + 1];
                      return (
                        <li key={item.id}>
                          <StockDate value={item.generated_at} locale={locale} />
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
              </StockRecordSection>
              <StockRecordSection sectionKey="metadata" id="stock-metadata-title" title={<Copy locale={locale}>Run metadata</Copy>}>
                <dl className={styles.summaryGrid}>
                  <Field label={<Copy locale={locale}>Run hash</Copy>}><Num>{run.immutable_hash}</Num></Field>
                  <Field label={<Copy locale={locale}>Generated</Copy>}><StockDate value={run.generated_at} locale={locale} /></Field>
                  <Field label={<Copy locale={locale}>Calculation version</Copy>}><bdi className={styles.code} dir="ltr">{run.calculation_version}</bdi></Field>
                  <Field label={<Copy locale={locale}>Engine version</Copy>}><bdi className={styles.code} dir="ltr">{run.engine_version}</bdi></Field>
                </dl>
                <p className={styles.appendOnly}><Copy locale={locale}>Screening runs are append-only. This record is never edited.</Copy></p>
              </StockRecordSection>
            </>
          )}
          <StockRecordSection sectionKey="disclaimer" id="stock-full-disclaimer-title" title={locale === "ar" ? arMessages.controls.fullDisclaimer : enMessages.controls.fullDisclaimer} className={styles.disclaimerSection}>
            <Disclaimer variant="full" locale={locale} className={styles.disclaimer} />
          </StockRecordSection>
        </div>
      </details>

      <section className={`${styles.section} ${styles.againBlock}`} data-section="search-again">
        <h2><Copy locale={locale}>Screen another stock</Copy></h2>
        <StockSearchForm locale={locale} />
      </section>
    </main>
  );
}
