import {
  AnalystByline,
  ConfidenceNote,
  CoverageSeal,
  EngineStatement,
  Num,
  StatusBadge,
} from "../foundation";
import { formatCompactMoney, formatMoney, formatNumber, scaleMultiplier } from "@/lib/format";
import { displayLabel } from "@/i18n/presentation";
import { stockCriterionLabel, stockUnknownEffect } from "@/i18n/stock-labels";
import { publicMethodologyVersionLabel } from "@/i18n/methodology-labels";
import { reviewText } from "../accounts/types";
import { stripPublicReviewMarker } from "../foundation/shared";
import type { PublicStockData, StockCriterion } from "@/stock/types";
import {
  Bilingual,
  Copy,
  CriterionValue,
  UnknownFieldLabel,
  Label,
  ReasonList,
  isBooleanCriterion,
  ActivityEvidenceNote,
  criterionExplanation,
} from "./StockVerdictParts";
import { ratioDisplay } from "./ratio-display";
import { StockDate } from "./StockDate";
import { StoredMonthlyClose } from "./StoredMonthlyClose";
import styles from "./StockVerdict.module.css";

import { isSuppliedDraft, missingFigure, uiOneDisplay, stockShortVersionLabel } from "@/i18n/approved-arabic-ui-one";

type Locale = "ar" | "en";
const fixedMeaning: Record<string, string> = {
  passes_selected_methodology:
    "The stock passed every criterion of this methodology on the available data. Passing is a screening outcome, not an investment decision.",
  fails_selected_methodology:
    "The stock does not pass this methodology on these data. Other methodologies may reach a different conclusion.",
  requires_review:
    "The result is not yet concluded: a criterion is close to its limit or could not be evaluated, or there is a data adequacy concern.",
  insufficient_data:
    "A criterion cannot be calculated because a required input is missing. No value was assumed.",
};
const whenText =
  "The result may change with a new disclosure, a review of the data, or a methodology update.";

const factFields = [
  ["market_cap", "Market capitalisation"],
  ["total_revenue", "Total revenue"],
  ["net_income", "Net income"],
  ["cash_and_equivalents", "Cash and equivalents"],
] as const;

function FactFigure({
  data,
  lineItem,
  label,
  locale,
}: {
  data: PublicStockData;
  lineItem: (typeof factFields)[number][0];
  label: (typeof factFields)[number][1];
  locale: Locale;
}) {
  const fact = data.facts.find((item) => item.line_item === lineItem);
  const multiplier = scaleMultiplier(fact?.unit_scale);
  let value = "—";
  if (fact?.value !== null && fact?.value !== undefined && multiplier !== null && fact.currency) {
    const scaled = fact.value * multiplier;
    try {
      value = fact.currency === "USD"
        ? formatCompactMoney(scaled)
        : formatMoney(scaled, locale, fact.currency, 1);
    } catch {
      value = "—";
    }
  }
  return (
    <div className={styles.factTile}>
      <span className={styles.factValue}><Num>{value}</Num></span>
      <span className={styles.factLabel}><Copy locale={locale}>{label}</Copy></span>
      <span className={styles.factPeriod}>
        <bdi dir="ltr">{data.period?.fiscal_period_label || "—"}</bdi>
        {data.period?.period_end && <> · <StockDate value={data.period.period_end} locale={locale} /></>}
      </span>
    </div>
  );
}

function ratioUnit(criterion: StockCriterion) {
  return criterion.threshold_unit?.startsWith("percent_") ? "%" : "";
}

function percent(value: number | null, locale: Locale, failed = false, threshold: number | null = null, unit = "") {
  return value === null ? "—" : `${ratioDisplay(value, threshold, failed, locale)}${unit}`;
}

export function RatioMeter({ criterion, locale }: { criterion: StockCriterion; locale: Locale }) {
  if (isBooleanCriterion(criterion)) return null;
  const ratio = criterion.ratio;
  const threshold = criterion.threshold;
  const direction = criterion.threshold_direction;
  const isMax = direction !== "min";
  const passOnly = isBooleanCriterion(criterion);
  const unit = criterion.threshold_unit?.startsWith("percent_") ? "%" : "";

  let fillPercent = 0;
  let markerPercent: number | null = null;
  let unknown = false;
  if (passOnly) {
    if (criterion.result === "pass") fillPercent = 100;
    else if (criterion.result === "fail") fillPercent = 0;
    else unknown = true;
  } else if (
    typeof ratio !== "number" ||
    !Number.isFinite(ratio) ||
    typeof threshold !== "number" ||
    !Number.isFinite(threshold)
  ) {
    unknown = true;
  } else if (threshold === 0) {
    if (isMax && ratio > 0) {
      fillPercent = 100;
      markerPercent = 0;
    } else {
      fillPercent = criterion.result === "pass" ? 100 : 0;
      markerPercent = 100;
    }
  } else if (isMax) {
    if (ratio <= threshold) {
      fillPercent = Math.max(0, Math.min(100, (ratio / threshold) * 100));
      markerPercent = 100;
    } else {
      fillPercent = 100;
      markerPercent = Math.max(0, Math.min(100, (threshold / ratio) * 100));
    }
  } else if (ratio >= threshold) {
    fillPercent = 100;
    markerPercent = Math.max(0, Math.min(100, (threshold / ratio) * 100));
  } else {
    fillPercent = Math.max(0, Math.min(100, (ratio / threshold) * 100));
    markerPercent = 100;
  }

  return (
    <div
      className={styles.ratioTrack}
      role="img"
      data-unknown={unknown ? "true" : undefined}
      aria-label={unknown
        ? reviewText(locale, "Unknown")
        : `${percent(ratio, locale, criterion.result === "fail", threshold, unit)} / ${percent(threshold, locale, false, null, unit)}`}
    >
      {!unknown && (
        <>
          <span
            className={styles.ratioFill}
            data-ux-ratio
            aria-hidden="true"
            data-result={direction !== "min" && ratio !== null && threshold !== null && ratio > threshold ? "fail" : criterion.result}
            style={{ width: `${fillPercent}%` }}
          />
          {markerPercent !== null && (
            <span className={styles.ratioMark} style={{ insetInlineStart: `${markerPercent}%` }} />
          )}
        </>
      )}
    </div>
  );
}

function CriterionRow({ criterion, locale }: { criterion: StockCriterion; locale: Locale }) {
  const explanation = criterionExplanation(criterion, locale);
  const label = stockCriterionLabel(criterion, locale) || reviewText(locale, "Unlabelled criterion");
  const isPercent = ratioUnit(criterion) === "%";
  const ratioText = criterion.ratio === null
    ? null
    : ratioDisplay(criterion.ratio, criterion.threshold, criterion.result === "fail", locale) + (isPercent ? "%" : "");
  const thresholdText = criterion.threshold === null
    ? "—"
    : `${formatNumber(criterion.threshold, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${isPercent ? "%" : ""}`;

  return (
    <article className={styles.ratioItem}>
      <div className={styles.ratioHeader}>
        <strong className={styles.ratioName}><Bilingual locale={locale} arabic={null} english={label} /></strong>
        <span className={styles.ratioResult} data-result={criterion.result}><Label family="result" value={criterion.result} locale={locale} /></span>
      </div>
      {!isBooleanCriterion(criterion) && <div className={styles.ratioNumbers}>
        {criterion.ratio === null && !isBooleanCriterion(criterion)
          ? <span><Label family="inputState" value="unknown" locale={locale} /></span>
          : criterion.ratio !== null && <span><Num>{ratioText}</Num></span>}
        {criterion.threshold !== null && <span><Copy locale={locale}>Limit</Copy>{" "}<Num>{thresholdText}</Num></span>}
      </div>}
      <RatioMeter criterion={criterion} locale={locale} />
      <ActivityEvidenceNote criterion={criterion} locale={locale} />
      {!isBooleanCriterion(criterion) && (
        <p className={styles.ratioNote}>
          <RatioNote criterion={criterion} locale={locale} />
          {criterion.numerator_value !== null && criterion.denominator_value !== null &&
          criterion.threshold_unit?.startsWith("percent_") &&
          criterion.threshold_direction !== "min" &&
          criterion.ratio !== null &&
          criterion.threshold !== null &&
          criterion.ratio > criterion.threshold
             ? <> · <Copy locale={locale}>Exceeded by</Copy>{" "}<Num>{ratioDisplay(Math.abs(criterion.ratio - criterion.threshold), 0, true, locale)}</Num>{" "}<Copy locale={locale}>percentage points</Copy></>
             : null}
        </p>
      )}
      {isBooleanCriterion(criterion) && explanation?.trim() && <p>{uiOneDisplay(explanation.trim(), locale)}</p>}
      {!isBooleanCriterion(criterion) && explanation?.trim() && (
        <details className={styles.criterionExplain}>
          <summary><Copy locale={locale}>What is this criterion?</Copy></summary>
          <p lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{stripPublicReviewMarker(explanation.trim())}</p>
        </details>
      )}
    </article>
  );
}

/** Labels identify the stored operands, never substitute the headline market cap. */
export function RatioNote({ criterion, locale }: { criterion: StockCriterion; locale: Locale }) {
  if (isBooleanCriterion(criterion)) return null;
  if (criterion.numerator_value === null || criterion.denominator_value === null)
    return <>{missingFigure[locale === "ar" ? 0 : 1]}</>;
  const numerator = criterion.numerator_definition || ({
    interest_bearing_debt: "interest_bearing_debt", non_permissible_revenue: "prohibited_income",
  } as Record<string, string>)[criterion.criterion_type] || criterion.criterion_label || criterion.criterion_type;
  const denominator = criterion.denominator_definition || ({
    percent_of_market_cap: "market_value_basis", percent_of_total_revenue: "total_revenue",
    percent_of_total_assets: "total_assets",
  } as Record<string, string>)[criterion.threshold_unit || ""] || "Denominator";
  const money = ratioUnit(criterion) === "%";
  return <>
    <UnknownFieldLabel value={numerator} locale={locale} />{" "}
    <CriterionValue value={criterion.numerator_value} locale={locale} compactMoney={money} />{" "}÷{" "}
    <UnknownFieldLabel value={denominator} locale={locale} />{" "}
    <CriterionValue value={criterion.denominator_value} locale={locale} compactMoney={money} />
  </>;
}

export function StockSummary({ data, locale }: { data: PublicStockData; locale: Locale }) {
  const { run, methodology, version, security } = data;
  const criteria = [...data.criteria].sort((a, b) => a.sort_order - b.sort_order);
  const eligibleSeal = Boolean(
    security.coverage_analyst_id && run?.status === "passes_selected_methodology",
  );
  const methodologyTitle = methodology?.name || run?.methodology_name;
  const versionLabel = version?.version_label || version?.version || run?.methodology_version_label;
  const methodologyHref = methodology && version
    ? `${locale === "en" ? "/en" : ""}/methodology/${encodeURIComponent(methodology.slug)}?version=${encodeURIComponent(version.version)}#methodology-${methodology.slug}-version-${encodeURIComponent(version.version)}`
    : null;
  const workflow = version?.workflow_status;
  const reasonStatus = run?.status ?? "";
  const meaning = fixedMeaning[reasonStatus];
  const publishedHref = eligibleSeal ? data.publishedPick?.href : null;
  const versionLabelText = publicMethodologyVersionLabel(stockShortVersionLabel(versionLabel || "", locale));
  // D-160: shorten only this known display name, never the stored/full-record identity.
  const shortMethodologyTitle = methodologyTitle === "Research implementation based on publicly documented criteria from Al Rajhi Capital"
    ? uiOneDisplay(methodologyTitle, locale).split(/\s+/).slice(0, locale === "ar" ? 3 : 2).join(" ")
    : methodologyTitle === "Suhail independent research"
      ? uiOneDisplay(methodologyTitle, locale)
      : methodologyTitle;

  return (
    <section className={styles.verdictPanel} data-section="why" aria-labelledby={run ? "stock-why-title" : "stock-no-run-title"}>
      <div className={styles.verdictStart}>
        {run ? (
          <>
            <div className={styles.badgeWithSeal}>
              <StatusBadge status={run.status} className={styles.largeBadge} />
              {eligibleSeal && (
                <div className={styles.sealByline} data-coverage-seal>
                  <CoverageSeal covered status={run.status} surface="dark" className={styles.sealDark} />
                  <CoverageSeal covered status={run.status} surface="light" className={styles.sealLight} />
                  {data.analyst && (
                    <div data-coverage-byline>
                      <ul className={styles.analystItems}>
                        <li><AnalystByline><Bilingual locale={locale} arabic={data.analyst.name_ar} english={data.analyst.name_en} /></AnalystByline></li>
                        {(data.analyst.title_ar || data.analyst.title_en) && <li><Bilingual locale={locale} arabic={data.analyst.title_ar} english={data.analyst.title_en} /></li>}
                        {data.analyst.credentials && <li><Bilingual locale={locale} arabic={null} english={data.analyst.credentials} /></li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={styles.reasonBlock}>
              <h2 id="stock-why-title" className={styles.srOnly}><Copy locale={locale}>Why this assessment</Copy></h2>
              {!(run.status === "passes_selected_methodology" && run.status_reasons.length === 0) && (
                <ReasonList reasons={run.status_reasons} locale={locale} passing={run.status === "passes_selected_methodology"} />
              )}
            </div>
            {meaning && (
              <div className={styles.meaningBlock}>
                <strong><Copy locale={locale}>What does this result mean?</Copy></strong>
                <p><Copy locale={locale}>{meaning}</Copy></p>
                <strong><Copy locale={locale}>When can it change?</Copy></strong>
                <p><Copy locale={locale}>{whenText}</Copy></p>
              </div>
            )}
            <EngineStatement className={styles.engineNote} />
            <dl className={styles.metaQuiet} data-section="summary-metadata">
              <div className={styles.metaRow} data-meta="methodology">
                <dt><Copy locale={locale}>Methodology</Copy></dt>
                <dd>
                  {methodologyHref ? (
                    <a className={styles.metaLink} href={methodologyHref}>
                      <span title={methodologyTitle ? uiOneDisplay(methodologyTitle, locale) : undefined}>
                        <Bilingual locale={locale} arabic={null} english={shortMethodologyTitle || ""} />
                      </span>
                    </a>
                  ) : methodologyTitle ? (
                    <span title={uiOneDisplay(methodologyTitle, locale)}>
                      <Bilingual locale={locale} arabic={null} english={shortMethodologyTitle} />
                    </span>
                  ) : <Copy locale={locale}>Methodology unavailable</Copy>}
                </dd>
              </div>
              <div className={styles.metaRow} data-meta="version">
                <dt><Copy locale={locale}>Version</Copy></dt>
                <dd>
                  <span className={styles.versionLabel} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{versionLabelText || "—"}</span>
                  {workflow && !isSuppliedDraft(versionLabel) && <span> · <Label family="workflow" value={workflow} locale={locale} /></span>}
                </dd>
              </div>
              <div className={styles.metaRow} data-meta="date-confidence">
                <dt><Copy locale={locale}>Data date</Copy></dt>
                <dd>
                  <StockDate value={run.data_as_of} locale={locale} />
                  <span className={styles.confidenceValue}><Copy locale={locale}>Confidence</Copy>: <Label family="confidence" value={run.confidence} locale={locale} /></span>
                  <ConfidenceNote className={styles.confidenceNote} />
                </dd>
              </div>
            </dl>
            {data.unknowns.length > 0 && (
              <div className={styles.unknownBox}>
                <h3><Copy locale={locale}>What we don&apos;t know</Copy></h3>
                <ul className={styles.unknownItems}>
                  {data.unknowns.map((unknown) => (
                    <li key={unknown.id}>
                      <strong><UnknownFieldLabel locale={locale} value={unknown.field_or_input} /></strong>
                      <span className={styles.effect}>
                        <Copy locale={locale}>Effect</Copy>:{" "}
                        {unknown.effect
                          ? <Bilingual locale={locale} arabic={null} english={stockUnknownEffect(unknown.effect, locale)} />
                          : <Copy locale={locale}>Not recorded</Copy>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {publishedHref && (
              <a className={styles.researchLink} href={publishedHref}>
                <Copy locale={locale}>Read the research</Copy>
              </a>
            )}
          </>
        ) : (
          <div className={styles.noRun}>
            <h3 id="stock-no-run-title"><Copy locale={locale}>No screening run recorded for this methodology yet.</Copy></h3>
            <p><Copy locale={locale}>No result is shown because no stored run is available.</Copy></p>
          </div>
        )}
      </div>
      {run && (
        <div className={styles.criteriaColumn}>
          <h2 id="stock-summary-criteria-title"><Copy locale={locale}>Criteria</Copy></h2>
          {criteria.length ? (
            <div className={styles.ratioList}>
              {criteria.map((criterion) => <CriterionRow key={criterion.id} criterion={criterion} locale={locale} />)}
            </div>
          ) : <p className={styles.muted}><Copy locale={locale}>No criterion evidence was stored for this run.</Copy></p>}
        </div>
      )}
    </section>
  );
}

export function StockFigures({ data, locale }: { data: PublicStockData; locale: Locale }) {
  return (
    <section className={styles.factsSummary} data-section="figures" aria-label={displayLabel("structured", "Fundamentals", locale)}>
      {factFields.map(([lineItem, label]) => (
        <FactFigure key={lineItem} data={data} lineItem={lineItem} label={label} locale={locale} />
      ))}
      {/* D-04: a fifth quiet evidence line, never a live quote or price direction. */}
      <StoredMonthlyClose close={data.storedClose} locale={locale} className={styles.storedClose}
        sourceUrl={data.sources.find(source => source.id === data.storedClose?.source_id)?.source_url} />
    </section>
  );
}
