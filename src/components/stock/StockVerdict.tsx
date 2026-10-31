import {
  AnalystByline, ConfidenceNote, CoverageSeal, DemoBanner,
  EngineStatement, ExampleMethodologyBanner, Num, StatusBadge,
} from "../foundation";
import { reviewText } from "../accounts/types";
import { formatCalendarDate, formatNumber, formatTimestamp } from "@/lib/format";
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
  unknownFieldNeedsFallback,
  isBooleanCriterion,
  RatioValue,
  ReasonList,
  SourceRefs,
  periodFiledDate,
  safeUrl,
  sourceFiledDate,
  sourceNumbers,
} from "./StockVerdictParts";
import styles from "./StockVerdict.module.css";
export function StockVerdict({ data, locale }: { data: PublicStockData; locale: "ar" | "en" }) {
  const { security, company, run, methodology, version } = data;
  const covered = Boolean(security.coverage_analyst_id);
  const eligibleSeal = covered && run?.status === "passes_selected_methodology";
  const sourceIndex = sourceNumbers(data.sources);
  const versionLabel = version?.version_label || version?.version || run?.methodology_version_label;
  const storedMethodologyTitle = methodology?.name || run?.methodology_name;
  // A localized UI fallback is not stored English narrative.
  const methodologyName = storedMethodologyTitle
    ? <Bilingual locale={locale} arabic={null} english={storedMethodologyTitle} />
    : <Copy locale={locale}>Methodology unavailable</Copy>;
  const methodologyHref = methodology && version
    ? `${locale === "en" ? "/en" : ""}/methodology/${encodeURIComponent(methodology.slug)}?version=${encodeURIComponent(version.version)}#methodology-${methodology.slug}-version-${encodeURIComponent(version.version)}`
    : null;
  const criteria = [...data.criteria].sort((a, b) => a.sort_order - b.sort_order);
  const history = [ ...(run ? [run] : []), ...data.priorRuns ].sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
  return (
    <main className={styles.page} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      {(security.is_demo || company.is_demo || Boolean(run?.is_demo)) && <DemoBanner className={styles.banner} />}
      {methodology?.official_or_inspired === "internal_example"
        ? <ExampleMethodologyBanner className={styles.banner} />
        : null}

      <header className={styles.companyHeader} data-section="header">
        <p className={styles.eyebrow}><Copy locale={locale}>PUBLIC SCREENING RECORD</Copy></p>
        <div className={styles.companyTitle}>
          <h1 lang={locale === "ar" && company.name_ar?.trim() ? "ar" : "en"}><bdi dir={locale === "ar" && company.name_ar?.trim() ? "rtl" : "ltr"}>{locale === "ar" && company.name_ar?.trim() ? company.name_ar.trim() : company.name}</bdi></h1>
          {locale === "ar" && company.name_ar?.trim() && <p className={styles.arabicName} lang="en" dir="ltr">{company.name}</p>}
        </div>
        <div className={styles.identityLine}>
          <span className={styles.ticker} dir="ltr">{security.display_symbol || security.ticker}</span>
          {data.exchange && (
            <span><Bilingual locale={locale} arabic={null} english={data.exchange.name} />{" "}
              {data.exchange.name !== data.exchange.code && <bdi className={styles.muted} dir="ltr">({data.exchange.code})</bdi>}
            </span>
          )}
          {company.sector_label && (
            <span><Copy locale={locale}>SEC label</Copy>{" "}
              <Bilingual locale={locale} arabic={null} english={company.sector_label} />
            </span>
          )}
        </div>
        {covered && (
          <div className={`${styles.headerByline} ${eligibleSeal ? styles.coveredByline : ""}`} data-coverage-byline>
            <Copy locale={locale}>Coverage by</Copy>
            {data.analyst ? (
              <ul className={styles.analystItems}>
                <li><AnalystByline>
                  <Bilingual locale={locale} arabic={data.analyst.name_ar} english={data.analyst.name_en} />
                </AnalystByline></li>
                {(data.analyst.title_ar || data.analyst.title_en) && (
                  <li><Bilingual locale={locale} arabic={data.analyst.title_ar} english={data.analyst.title_en} /></li>
                )}
                {data.analyst.credentials && (
                  <li><Bilingual locale={locale} arabic={null} english={data.analyst.credentials} /></li>
                )}
              </ul>
            ) : <span> <Copy locale={locale}>Analyst profile unavailable</Copy></span>}
          </div>
        )}
        <LanguageNotice locale={locale} needed={locale === "ar" && (!company.name_ar?.trim() || Boolean(company.sector_label) || Boolean(data.analyst && (!data.analyst.name_ar || (!data.analyst.title_ar && data.analyst.title_en) || data.analyst.credentials)))} />
        <LanguageNotice locale={locale} needed={locale === "en" && Boolean(data.analyst && !data.analyst.name_en && data.analyst.name_ar)} reverse />
      </header>
      <section className={`${styles.section} ${styles.screening}`} data-section="screening" aria-labelledby="stock-screening-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}><Copy locale={locale}>SCREENING RESULT</Copy></p>
          <h2 id="stock-screening-title"><Copy locale={locale}>Screening</Copy></h2>
        </div>
        {run ? (
          <>
            <div className={styles.screeningTop}>
              <StatusBadge status={run.status} />
              {eligibleSeal && (
                <div data-coverage-seal className={styles.sealByline}>
                  <CoverageSeal covered status={run.status} surface="dark" className={styles.sealDark} />
                  <CoverageSeal covered status={run.status} surface="light" className={styles.sealLight} />
                  {data.analyst && (
                    <AnalystByline>
                      <Bilingual locale={locale} arabic={data.analyst.name_ar} english={data.analyst.name_en} />
                    </AnalystByline>
                  )}
                </div>
              )}
            </div>
            <dl className={styles.summaryGrid}>
              <Field label={<Copy locale={locale}>Under</Copy>}>
                {methodologyHref ? (
                  <a className={styles.textLink} href={methodologyHref}>
                    {methodologyName}{" "}
                    <bdi className={styles.code} dir="ltr">{versionLabel}</bdi>
                  </a>
                ) : (
                  <>{methodologyName}{" "}
                     <bdi className={styles.code} dir="ltr">{versionLabel}</bdi></>
                )}
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
             <LanguageNotice locale={locale} needed={locale === "ar" && Boolean(storedMethodologyTitle)} />
            <a href="#stock-why" className={styles.whyLink}>
              <Copy locale={locale}>Why?</Copy><span aria-hidden="true">↓</span>
            </a>
          </>
        ) : (
          <div className={styles.noRun}>
            <h3><Copy locale={locale}>No screening run recorded for this methodology yet.</Copy></h3>
            <p><Copy locale={locale}>No result is shown because no stored run is available.</Copy></p>
          </div>
        )}
      </section>
      {run && (
        <>
          <section className={styles.section} data-section="why" id="stock-why" aria-labelledby="stock-why-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>DETERMINISTIC RECORD</Copy></p>
              <h2 id="stock-why-title"><Copy locale={locale}>Why this assessment</Copy></h2>
            </div>
            <ReasonList reasons={run.status_reasons} locale={locale} passing={run.status === "passes_selected_methodology"} />
            <EngineStatement className={styles.engineNote} />
          </section>
          <section className={styles.section} data-section="known" aria-labelledby="stock-known-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>STORED RUN EVIDENCE</Copy></p>
              <h2 id="stock-known-title"><Copy locale={locale}>What we know</Copy></h2>
            </div>
            {criteria.length ? (
              <ul className={styles.evidenceList}>
                {criteria.map((criterion) => (
                  <li key={criterion.id}>
                    <strong><Bilingual locale={locale} arabic={null} english={criterion.criterion_label || reviewText(locale, "Unlabelled criterion")} /></strong>
                     <dl className={styles.evidenceFields}>
                       <Field label={<Copy locale={locale}>Result</Copy>}><Label family="result" value={criterion.result} locale={locale} /></Field>
                       {!isBooleanCriterion(criterion) && <>
                         <Field label={<Copy locale={locale}>Numerator</Copy>}><CriterionValue value={criterion.numerator_value} locale={locale} /></Field>
                         <Field label={<Copy locale={locale}>Denominator</Copy>}><CriterionValue value={criterion.denominator_value} locale={locale} /></Field>
                         <Field label={<Copy locale={locale}>Ratio</Copy>}><RatioValue criterion={criterion} value={criterion.ratio} locale={locale} /></Field>
                       </>}
                     </dl>
                    <SourceRefs ids={criterion.source_ids} numbers={sourceIndex} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : <p className={styles.muted}><Copy locale={locale}>No criterion evidence was stored for this run.</Copy></p>}
             <LanguageNotice locale={locale} needed={locale === "ar" && criteria.length > 0} />
          </section>
          <section className={styles.section} data-section="unknown" aria-labelledby="stock-unknown-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>RECORDED GAPS</Copy></p>
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
                          ? <Bilingual locale={locale} arabic={null} english={unknown.why_missing} />
                          : reviewText(locale, "Not recorded")}
                      </Field>
                      <Field label={<Copy locale={locale}>Effect</Copy>}>
                        {unknown.effect
                          ? <Bilingual locale={locale} arabic={null} english={unknown.effect} />
                          : reviewText(locale, "Not recorded")}
                      </Field>
                      <Field label={<Copy locale={locale}>Severity</Copy>}>
                         <Label family="severity" value={unknown.severity} locale={locale} />
                      </Field>
                    </dl>
                  </li>
                ))}
              </ul>
            ) : <p><Copy locale={locale}>No unknown inputs were recorded for this run.</Copy></p>}
             <LanguageNotice locale={locale} needed={locale === "ar" && data.unknowns.some(item => Boolean(item.why_missing || item.effect) || unknownFieldNeedsFallback(item.field_or_input, locale))} />
          </section>

          <section className={styles.section} data-section="methodology" aria-labelledby="stock-method-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>DOCUMENTED RULE SET</Copy></p>
              <h2 id="stock-method-title"><Copy locale={locale}>Methodology</Copy></h2>
            </div>
            <p className={styles.methodName}>
              {methodologyName}{" "}
               <bdi className={styles.code} dir="ltr">{versionLabel}</bdi>
            </p>
            {methodology?.scope && (
              <p className={styles.scope}>
                <span lang="en" dir="ltr">{methodology.scope}</span>
              </p>
            )}
             <LanguageNotice locale={locale} needed={locale === "ar" && Boolean(storedMethodologyTitle || methodology?.scope)} />
            {methodologyHref && (
              <a href={methodologyHref} className={styles.textLink}>
                <Copy locale={locale}>Open methodology and this version</Copy><span aria-hidden="true">↗</span>
              </a>
            )}
          </section>

          <section className={styles.section} data-section="criteria" aria-labelledby="stock-criteria-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>CRITERION RECORD</Copy></p>
              <h2 id="stock-criteria-title"><Copy locale={locale}>Criteria</Copy></h2>
            </div>
            <CriteriaTable criteria={criteria} sources={sourceIndex} locale={locale} />
             <LanguageNotice locale={locale} needed={locale === "ar" && criteria.length > 0} />
          </section>

          {data.explanation && <ExplanationSlot explanation={data.explanation} locale={locale} />}

          <section className={styles.section} data-section="fundamentals" aria-labelledby="stock-fundamentals-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>CURRENT PERIOD FACTS</Copy></p>
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
                          ? <Num>{formatNumber(fact.value, locale, { maximumFractionDigits: 6 })}</Num>
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
            <LanguageNotice locale={locale} needed={locale === "ar" && data.facts.some(fact => fact.value !== null ? false : Boolean(fact.value_text))} />
          </section>

          <section className={styles.section} data-section="sources" aria-labelledby="stock-sources-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>PROVENANCE</Copy></p>
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
                        <h3><Bilingual locale={locale} arabic={null} english={title} /></h3>
                         <dl>
                           <Field label={<Copy locale={locale}>Type</Copy>}><Label family="sourceType" value={source.source_type} locale={locale} /></Field>
                           <Field label={<Copy locale={locale}>Accession / reference</Copy>}><bdi dir="ltr">{source.document_reference || reviewText(locale, "Unavailable")}</bdi></Field>
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
             <LanguageNotice locale={locale} needed={locale === "ar" && data.sources.length > 0} />
          </section>

          <section className={styles.section} data-section="history" aria-labelledby="stock-history-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}><Copy locale={locale}>APPEND-ONLY RUNS</Copy></p>
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
              <p className={styles.eyebrow}><Copy locale={locale}>IMMUTABLE RUN RECORD</Copy></p>
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

    </main>
  );
}
