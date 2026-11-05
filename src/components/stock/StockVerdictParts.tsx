import type { ReactNode } from "react";
import { PublicLocalizedText as LocalizedText, stripPublicReviewMarker } from "../foundation/shared";
import { Num } from "../foundation/Num";
import { reviewText, type Locale } from "../accounts/types";
import { formatCalendarDate, formatCompactMoney, formatNumber, formatPercent } from "@/lib/format";
import { stockCriterionLabel, stockReasonField, stockUnknownEffect, arabicKnownReason } from "@/i18n/stock-labels";
import { displayReason, visibleReasons } from "@/stock/presentation";
import { uiOneDisplay, uiOneProse } from "@/i18n/approved-arabic-ui-one";
import type { StatusReason } from "@/engine/types";
import type { PublicStockData, StockCriterion, StockSource } from "@/stock/types";
import styles from "./StockVerdict.module.css";
import { displayLabel, presentationLabels, type LabelFamily } from "@/i18n/presentation";
import { ratioDisplay } from "./ratio-display";

const stockReviewPhrases = [
  "English only", "Arabic only", "Not recorded", "No specific status reasons were recorded.",
  "Stored criterion labels are English only", "No reason template available.",
  "No criteria were recorded for this run.", "Criterion", "Ratio", "Threshold", "Numerator",
  "Denominator", "Input state", "Confidence tier", "Calculation", "Result", "Borderline margin",
  "Show calculation", "Unlabelled criterion", "No calculation trace was stored.",
  "AI explanation", "Arabic narrative is not available; structured evidence only.",
  "AI text discarded — showing structured evidence only",
  "No validated narrative text is stored; structured evidence only.",
  "The generated text did not pass validation against the engine's evidence, so it was discarded. Every figure below comes straight from the engine.",
  "Every figure in this text was checked against the engine's evidence.", "Structured evidence",
  "SEC label", "Coverage by", "Analyst profile unavailable",
  "Screening", "Under", "Period end", "Filing date", "Confidence", "Data adequacy",
  "Data date", "Why?", "No screening run recorded for this methodology yet.",
  "No result is shown because no stored run is available.",
  "Why this assessment", "What we know", "Result", "Numerator",
  "Denominator", "Ratio", "No criterion evidence was stored for this run.",
  "What we don't know", "Why missing", "Effect", "Severity",
  "No unknown inputs were recorded for this run.", "Methodology",
  "Open methodology and this version", "Criteria",
  "Fundamentals", "Label", "Value", "Unit", "Period", "Source",
  "No current-period facts were recorded.", "Sources", "Type", "Accession / reference",
  "Filed date", "Open source", "No sources were stored for this page.",
  "Change history / prior runs", "Current", "Unchanged", "No earlier run for this methodology.",
  "Run metadata", "Run hash", "Generated", "Calculation version",
  "Engine version", "Screening runs are append-only. This record is never edited.",
  "Source reference", "Methodology unavailable", "Unavailable",
  "Unavailable in the stored source record",
] as const;
type StockReviewPhrase = (typeof stockReviewPhrases)[number];
const reviewedStockCopy = Object.fromEntries(stockReviewPhrases.map((phrase) => [
  phrase,
  (locale: Locale) => reviewText(locale, phrase),
])) as Record<StockReviewPhrase, (locale: Locale) => string>;

export function Copy({ locale, children }: { locale: Locale; children: string }) {
  const reviewed = reviewedStockCopy[children as StockReviewPhrase];
  const mapped = uiOneDisplay(children, locale);
  return <LocalizedText>{mapped !== children ? mapped : reviewed ? reviewed(locale) : reviewText(locale, children)}</LocalizedText>;
}

export function Bilingual({
  locale,
  arabic,
  english,
}: {
  locale: Locale;
  arabic: string | null | undefined;
  english: string | null | undefined;
}) {
  const map = (value: string | null | undefined) => value ? uiOneProse(value.trim(), locale) : value;
  const primary = map(locale === "ar" ? arabic : english);
  const fallback = map(locale === "ar" ? english : arabic);
  if (typeof primary === "string" && primary.trim()) return <bdi lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>{stripPublicReviewMarker(primary.trim())}</bdi>;
  if (typeof fallback === "string" && fallback.trim()) {
    const fallbackLocale = /[\p{Script=Arabic}]/u.test(fallback) ? "ar" : "en";
    return <span className={styles.fallback}><bdi lang={fallbackLocale} dir={fallbackLocale === "ar" ? "rtl" : "ltr"}>{stripPublicReviewMarker(fallback.trim())}</bdi></span>;
  }
  return <span className={styles.missing}><Copy locale={locale}>Not recorded</Copy></span>;
}

/** True for readable English narrative, not numbers, codes, IDs, or snake_case values. */
export function hasEnglishOnlyNarrative(value: string | null | undefined) {
  const text = stripPublicReviewMarker(value?.trim() ?? "");
  if (!text || /[\p{Script=Arabic}]/u.test(text) || !/[A-Za-z]/.test(text)) return false;
  if (/^[A-Z0-9]+(?:[._:/+-][A-Z0-9]+)*$/.test(text)) return false;
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(text)) return false;
  if (/^(?:v|engine-|calc-)\d+(?:[.-]\d+)*$/i.test(text)) return false;
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(text)) return false;
  // D-157: names and short labels are not whole English narrative.
  return (text.split(/\s+/).length >= 3 && /[.!?](?:\s|$)/.test(text)) || text.split(/\s+/).length >= 8;
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className={styles.field}><dt>{label}</dt><dd>{children}</dd></div>;
}

export function Label({ family, value, locale }: { family: LabelFamily; value: string | null | undefined; locale: Locale }) {
  const mapped = value ? uiOneDisplay(value, locale) : value;
  return <bdi>{stripPublicReviewMarker(mapped && mapped !== value ? mapped : displayLabel(family, value, locale))}</bdi>;
}

// Missing-input names are stored evidence, not an enum: the engine can use a
// configured denominator definition or a narrative name such as Data freshness.
export function unknownFieldNeedsFallback(value: string, locale: Locale) {
  return locale === "ar" && !Object.hasOwn(presentationLabels.lineItem, value)
    && /[A-Za-z]/.test(reviewText(locale, value)) && !/[\p{Script=Arabic}]/u.test(uiOneDisplay(value, locale));
}

export function UnknownFieldLabel({ value, locale }: { value: string; locale: Locale }) {
  const mapped = uiOneDisplay(value, locale);
  if (mapped !== value) return <bdi>{mapped}</bdi>;
  const localized = stockReasonField(value, locale);
  if (localized !== value) return <bdi>{localized}</bdi>;
  if (Object.hasOwn(presentationLabels.lineItem, value)) {
    return <Label family="lineItem" value={value} locale={locale} />;
  }
  const fallback = unknownFieldNeedsFallback(value, locale);
  return <span className={styles.fallback}><bdi lang={fallback ? "en" : locale} dir={fallback || locale === "en" ? "ltr" : "rtl"}>{stripPublicReviewMarker(reviewText(locale, value))}</bdi></span>;
}

/** D-150: stock callers aggregate once beneath the company header. */
export function LanguageNotice({ locale, needed, reverse = false, sections = [] }: { locale: Locale; needed: boolean; reverse?: boolean; sections?: string[] }) {
  if (!needed) return null;
  return <p data-language-notice className={styles.languageMarker}>
    <Copy locale={locale}>{reverse ? "Arabic only" : "English only"}</Copy>
    {sections.length > 0 && <>: {sections.map((section, index) => <span key={section}>
      {index > 0 ? locale === "ar" ? "، " : ", " : ""}<Copy locale={locale}>{section}</Copy>
    </span>)}</>}
  </p>;
}

export function isBooleanCriterion(criterion: StockCriterion) {
  return criterion.criterion_type === "business_activity" || criterion.threshold_unit === "boolean";
}

export function ActivityEvidenceNote({ criterion, locale }: { criterion: StockCriterion; locale: Locale }) {
  if (criterion.criterion_type !== "business_activity") return null;
  const trace = criterion.calculation_trace ?? "";
  const sourcePeriods = [...new Set([...trace.matchAll(/\(from ([^)]+) filing\)/g)].map(match => match[1]))];
  const sic = trace.match(/SEC SIC code (\d{3,4})/);
  return <>
    {sourcePeriods.map(period => <p key={period}>{stripPublicReviewMarker(reviewText(locale, "Source period"))}: <bdi>{period}</bdi>{" "}
      (<Label family="tier" value="Estimated" locale={locale} />)</p>)}
    {sic && <p>{stripPublicReviewMarker(reviewText(locale, "Suhail SIC mapping v1 — pending analyst review"))}{" · "}
      <Copy locale={locale}>SEC SIC code</Copy>{" "}<bdi dir="ltr">{sic[1]}</bdi></p>}
  </>;
}

export function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sourceNumbers(sources: StockSource[]) {
  return new Map<string, number>(sources.map((source, index) => [source.id, index + 1] as const));
}

export function SourceRefs({
  ids,
  numbers,
  locale,
}: {
  ids: string[];
  numbers: Map<string, number>;
  locale: Locale;
}) {
  const refs = ids.map((id) => numbers.get(id)).filter((number): number is number => number !== undefined);
  if (!refs.length) return null;
  return (
    <span className={styles.sourceRefs} aria-label={stripPublicReviewMarker(reviewText(locale, "Sources"))}>
      {refs.map((number) => (
        <a key={number} href={`#source-${number}`} aria-label={stripPublicReviewMarker(reviewText(locale, "Source reference"))}>
          [<Num>{number}</Num>]
        </a>
      ))}
    </span>
  );
}

function amount(value: number | null, locale: Locale) {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatNumber(value, locale, { maximumFractionDigits: 2 });
}

export function CriterionValue({ value, locale, compactMoney = false }: { value: number | null; locale: Locale; compactMoney?: boolean }) {
  return <Num>{compactMoney ? formatCompactMoney(value) : value === null ? "—" : amount(value, locale)}</Num>;
}

function ThresholdValue({ criterion, value, locale, limit = false }: { criterion: StockCriterion; value: number | null; locale: Locale; limit?: boolean }) {
  if (value === null) return <>{limit ? uiOneDisplay("null", locale) : "—"}</>;
  const isPercent = criterion.threshold_unit?.startsWith("percent_");
  return <Num>{isPercent ? formatPercent(value / 100, locale) : formatNumber(value, locale, { maximumFractionDigits: 2 })}</Num>;
}

export function RatioValue({ criterion, value, locale }: { criterion: StockCriterion; value: number | null; locale: Locale }) {
  if (value === null) return <>—</>;
  const isPercent = criterion.threshold_unit?.startsWith("percent_");
  return <Num>{ratioDisplay(value, criterion.threshold, criterion.result === "fail", locale)}{isPercent ? "%" : ""}</Num>;
}

export function EvidenceValue({ definition, value, locale }: { definition: string | null; value: number | null; locale: Locale }) {
  return <span className={styles.valueStack}>
    {definition?.trim() && <Bilingual locale={locale} arabic={null} english={definition} />}
    <CriterionValue value={value} locale={locale} />
  </span>;
}

const reasonKinds = new Set(["failure", "borderline", "criterion_unknown", "blocking_unknown", "review_unknown", "counts"]);
const reasonCodes = new Set([
  "boolean_positive", "boolean_nonpositive", "within_margin", "max_within_limit", "max_exceeded",
  "min_met", "min_not_met", "denominator_unavailable", "denominator_nonpositive", "numerator_unavailable",
  "no_segments", "shares_unavailable", "unclassified_primary", "primary_tied", "primary_prohibited",
  "primary_permissible", "evaluator_unregistered", "stale_data", "criterion_counts",
]);
const thresholdUnits = new Set(["percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap", "boolean", "absolute"]);

function storedReasonToEngine(value: unknown): StatusReason | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Record<string, unknown>;
  const get = (camel: string, snake: string) => stored[camel] ?? stored[snake];
  const kind = stored.kind;
  const reasonCode = get("reasonCode", "reason_code");
  const thresholdUnit = get("thresholdUnit", "threshold_unit") ?? null;
  const ratio = stored.ratio ?? null;
  const threshold = stored.threshold ?? null;
  const label = stored.label ?? stored.criterion_label ?? "";
  const criterionId = get("criterionId", "criterion_id") ?? null;
  const field = stored.field ?? null;
  if (typeof kind !== "string" || !reasonKinds.has(kind) || typeof reasonCode !== "string" || !reasonCodes.has(reasonCode)) return null;
  if (thresholdUnit !== null && (typeof thresholdUnit !== "string" || !thresholdUnits.has(thresholdUnit))) return null;
  if ((ratio !== null && (typeof ratio !== "number" || !Number.isFinite(ratio))) ||
      (threshold !== null && (typeof threshold !== "number" || !Number.isFinite(threshold)))) return null;
  if ((criterionId !== null && typeof criterionId !== "string") || typeof label !== "string" ||
      (field !== null && typeof field !== "string")) return null;
  const borderlineCount = get("borderlineCount", "borderline_count");
  const unknownCount = get("unknownCount", "unknown_count");
  return {
    kind: kind as StatusReason["kind"],
    criterionId: criterionId as string | null,
    label,
    ratio: ratio as number | null,
    threshold: threshold as number | null,
    thresholdUnit: thresholdUnit as StatusReason["thresholdUnit"],
    reasonCode: reasonCode as StatusReason["reasonCode"],
    field: field as string | null,
    ...(typeof borderlineCount === "number" ? { borderlineCount } : {}),
    ...(typeof unknownCount === "number" ? { unknownCount } : {}),
  };
}

/** D-157: reuse the deterministic explanation if no activity UI explanation exists. */
export function criterionExplanation(criterion: StockCriterion, locale: Locale) {
  const configured = locale === "ar" ? criterion.explanation_ar : criterion.explanation_en;
  if (configured?.trim()) return uiOneProse(configured.trim(), locale);
  if (!isBooleanCriterion(criterion)) return null;
  const reason = storedReasonToEngine({
    kind: "criterion_unknown", label: criterion.criterion_label || "",
    criterionId: criterion.criterion_id, reasonCode: criterion.result_reason,
  });
  return reason ? displayReason(reason, locale).split(" — ").slice(1).join(" — ") : null;
}

export function statusReasonsNeedFallback(reasons: unknown[]) {
  return reasons.some(stored => {
    const reason = storedReasonToEngine(stored);
    return reason ? [stockCriterionLabel({ criterion_label: reason.label }, "ar"),
      reason.field && stockReasonField(reason.field, "ar")].some(value => hasEnglishOnlyNarrative(uiOneProse(value || "", "ar")))
      : hasEnglishOnlyNarrative(reviewText("ar", "No reason template available."));
  });
}

export function ReasonList({ reasons, locale, passing = false }: { reasons: unknown[]; locale: Locale; passing?: boolean }) {
  if (!reasons.length) return <p className={styles.muted}><Copy locale={locale}>{passing ? "All recorded criteria passed. No additional status reasons were recorded." : "No specific status reasons were recorded."}</Copy></p>;
  const parsed = reasons.map(storedReasonToEngine);
  const visible = visibleReasons(parsed.filter((r): r is StatusReason => r !== null));
  if (!visible.length && parsed.every(Boolean)) return null;
  return (
    <ul className={styles.reasonList}>
      {[...visible, ...parsed.filter(r => r === null)].map((original, index) => {
        const reason = original && locale === "ar" ? { ...original,
          label: stockCriterionLabel({ criterion_label: original.label }, locale),
          field: original.field ? stockReasonField(original.field, locale) : original.field,
        } : original;
        return <li key={`${reason?.kind ?? "unknown"}-${reason?.criterionId ?? reason?.field ?? index}`} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
          {/* D-150: strip only the rendered token, never edit/approve §7.3 templates or stored reasons. */}
          {reason ? stripPublicReviewMarker(displayReason(reason, locale)) : <Copy locale={locale}>No reason template available.</Copy>}
        </li>;
      })}
    </ul>
  );
}

const valueFamilies: Record<string, LabelFamily> = {
  category: "activity", activity_category: "activity", prohibited_categories: "activity", non_permissible_categories: "activity",
  result: "result", input_state: "inputState", input_states: "inputState", confidence_tier: "tier",
  confidence: "confidence", data_adequacy: "adequacy", source_type: "sourceType", unit_scale: "scale",
  threshold_unit: "thresholdUnit", thresholdUnit: "thresholdUnit", severity: "severity", line_item: "lineItem",
};

export function criteriaNeedFallback(criteria: StockCriterion[]) {
  return criteria.some(criterion =>
    hasEnglishOnlyNarrative(stockCriterionLabel(criterion, "ar") || reviewText("ar", "Unlabelled criterion")) ||
    hasEnglishOnlyNarrative(criterionExplanation(criterion, "ar")) ||
    (!isBooleanCriterion(criterion) && (
      hasEnglishOnlyNarrative(uiOneDisplay(criterion.numerator_definition || "", "ar")) ||
      hasEnglishOnlyNarrative(uiOneDisplay(criterion.denominator_definition || "", "ar")) ||
      hasEnglishOnlyNarrative(uiOneProse(criterion.calculation_trace || reviewText("ar", "No calculation trace was stored."), "ar"))
    )),
  );
}

export function unknownsNeedFallback(unknowns: PublicStockData["unknowns"]) {
  return unknowns.some(item =>
    hasEnglishOnlyNarrative(
      Object.hasOwn(presentationLabels.lineItem, item.field_or_input)
        ? displayLabel("lineItem", item.field_or_input, "ar")
        : reviewText("ar", item.field_or_input),
    ) ||
    hasEnglishOnlyNarrative(uiOneDisplay(arabicKnownReason(item.why_missing) ?? item.why_missing ?? "", "ar")) ||
    hasEnglishOnlyNarrative(uiOneDisplay(item.effect ? stockUnknownEffect(item.effect, "ar") : "", "ar")),
  );
}

function structuredValueNeedsFallback(value: unknown, field?: string): boolean {
  if (value === null || value === undefined || typeof value === "number") return false;
  if (typeof value === "boolean") return hasEnglishOnlyNarrative(reviewText("ar", value ? "Yes" : "No"));
  if (typeof value === "string") {
    if (field === "source_title" || field === "document_title") return false;
    const family = field ? valueFamilies[field] : undefined;
    const shown = family
      ? displayLabel(family, value, "ar")
      : /^[a-z]+(?:_[a-z]+)+$/.test(value)
        ? displayLabel("structured", value, "ar")
        : uiOneDisplay(value, "ar");
    return hasEnglishOnlyNarrative(shown);
  }
  if (Array.isArray(value)) return value.some(item => structuredValueNeedsFallback(item, field));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    hasEnglishOnlyNarrative(displayLabel("structured", key, "ar")) ||
    structuredValueNeedsFallback(item, key),
  );
}

export function structuredEvidenceNeedsFallback(value: unknown) {
  return structuredValueNeedsFallback(value);
}

export function sourcesNeedFallback(sources: StockSource[], data: PublicStockData) {
  return sources.some(source =>
    hasEnglishOnlyNarrative(sourceFiledDate(source, data, "ar")),
  );
}

function StructuredValue({ value, locale, field }: { value: unknown; locale: Locale; field?: string }) {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "string") {
    const family = field ? valueFamilies[field] : undefined;
    const text = value === null || value === undefined ? "—" : typeof value === "boolean"
       ? stripPublicReviewMarker(reviewText(locale, value ? "Yes" : "No"))
       : family ? stripPublicReviewMarker(displayLabel(family, String(value), locale))
      : uiOneDisplay(String(value), locale) !== String(value) ? uiOneDisplay(String(value), locale)
      : /^[a-z]+(?:_[a-z]+)+$/.test(String(value)) ? stripPublicReviewMarker(displayLabel("structured", String(value), locale)) : String(value);
    return <bdi dir="auto">{stripPublicReviewMarker(text)}</bdi>;
  }
  if (typeof value === "number") return <Num>{formatNumber(value, locale, { maximumFractionDigits: 2 })}</Num>;
  if (Array.isArray(value)) {
    return value.length ? <ul className={styles.nestedList}>{value.map((item, i) => <li key={i}><StructuredValue value={item} locale={locale} field={field} /></li>)}</ul> : <>—</>;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return <>—</>;
  return <dl className={styles.structured}>{entries.map(([key, item]) => <div key={key}><dt><Label family="structured" value={key} locale={locale} /></dt><dd><StructuredValue value={item} locale={locale} field={key} /></dd></div>)}</dl>;
}

export function sourceFiledDate(source: StockSource, data: PublicStockData, locale: Locale) {
  return data.period?.source_id === source.id && data.period.reported_date
    ? formatCalendarDate(data.period.reported_date, locale)
    : stripPublicReviewMarker(reviewText(locale, "Unavailable in the stored source record"));
}

export function periodFiledDate(data: PublicStockData, locale: Locale) {
  return data.period?.source_id && data.period.reported_date
    ? formatCalendarDate(data.period.reported_date, locale)
    : stripPublicReviewMarker(reviewText(locale, "Unavailable"));
}

export function CriteriaTable({ criteria, sources, locale }: { criteria: StockCriterion[]; sources: Map<string, number>; locale: Locale }) {
  const booleanCriteria = criteria.filter(isBooleanCriterion);
  const ratioCriteria = criteria.filter(criterion => !isBooleanCriterion(criterion));
  const headers = ["Criterion", "Result", "Ratio", "Threshold", "Numerator", "Denominator", "Input state", "Confidence tier", "Calculation", "Borderline margin"];
  const label = (criterion: StockCriterion) => stockCriterionLabel(criterion, locale) || reviewText(locale, "Unlabelled criterion");
  if (!criteria.length) return <p className={styles.muted}><Copy locale={locale}>No criteria were recorded for this run.</Copy></p>;
  return (
    <>
      {booleanCriteria.map(criterion => <article data-ux-card className={styles.booleanCard} key={criterion.id}>
        <h3><Bilingual locale={locale} arabic={null} english={label(criterion)} /></h3>
        <dl className={styles.cardFields}>
          <Field label={<Copy locale={locale}>Result</Copy>}><Label family="result" value={criterion.result} locale={locale} /></Field>
        </dl>
        {criterionExplanation(criterion, locale) && <p>{criterionExplanation(criterion, locale)}</p>}
        <ActivityEvidenceNote criterion={criterion} locale={locale} />
        <SourceRefs ids={criterion.source_ids} numbers={sources} locale={locale} />
      </article>)}
    {ratioCriteria.length > 0 && <div className={styles.criteriaWrap} role="region" aria-label={stripPublicReviewMarker(reviewText(locale, "Criteria"))} tabIndex={0}>
      <table className={styles.criteriaTable}>
        <thead><tr>{headers.map((header) => <th key={header} scope="col"><Copy locale={locale}>{header}</Copy></th>)}</tr></thead>
        <tbody>
          {ratioCriteria.map((criterion) => {
            const cells = [
              <Bilingual key="criterion" locale={locale} arabic={null} english={label(criterion)} />,
              <span key="result" className={styles.result}><Label family="result" value={criterion.result} locale={locale} /></span>,
              <RatioValue key="ratio" criterion={criterion} value={criterion.ratio} locale={locale} />,
              <ThresholdValue key="threshold" criterion={criterion} value={criterion.threshold} locale={locale} limit />,
              <EvidenceValue key="numerator" definition={criterion.numerator_definition} value={criterion.numerator_value} locale={locale} />,
              <EvidenceValue key="denominator" definition={criterion.denominator_definition} value={criterion.denominator_value} locale={locale} />,
               <span key="state">{criterion.input_states.map(state => <span className={styles.valueStack} key={state}><Label family="inputState" value={state} locale={locale} /></span>)}</span>,
               <Label key="tier" family="tier" value={criterion.confidence_tier} locale={locale} />,
              <details key="calc" className={styles.calculation}><summary><Copy locale={locale}>Show calculation</Copy></summary><p><Bilingual locale={locale} arabic={null} english={criterion.calculation_trace || reviewText(locale, "No calculation trace was stored.")} /></p></details>,
              <ThresholdValue key="margin" criterion={criterion} value={criterion.borderline_margin} locale={locale} />,
            ];
            return <tr key={criterion.id}>{cells.map((cell, i) => <td key={headers[i]} data-label={stripPublicReviewMarker(reviewText(locale, headers[i]))}>{cell}</td>)}</tr>;
          })}
        </tbody>
      </table>
      <div className={styles.criteriaCards}>
        {ratioCriteria.map((criterion) => (
          <article data-ux-card className={styles.criterionCard} key={criterion.id}>
            <h3><Bilingual locale={locale} arabic={null} english={label(criterion)} /> <span className={styles.result}><Label family="result" value={criterion.result} locale={locale} /></span></h3>
            <dl className={styles.cardFields}>
              {headers.filter((head) => !["Criterion", "Calculation"].includes(head)).map((head) => {
                const values: Record<string, ReactNode> = {
                  Ratio: <RatioValue criterion={criterion} value={criterion.ratio} locale={locale} />,
                  Threshold: <ThresholdValue criterion={criterion} value={criterion.threshold} locale={locale} limit />,
                  Numerator: <EvidenceValue definition={criterion.numerator_definition} value={criterion.numerator_value} locale={locale} />,
                  Denominator: <EvidenceValue definition={criterion.denominator_definition} value={criterion.denominator_value} locale={locale} />,
                  "Input state": criterion.input_states.map(state => <Label key={state} family="inputState" value={state} locale={locale} />),
                  "Confidence tier": <Label family="tier" value={criterion.confidence_tier} locale={locale} />,
                  Result: <Label family="result" value={criterion.result} locale={locale} />,
                  "Borderline margin": <ThresholdValue criterion={criterion} value={criterion.borderline_margin} locale={locale} />,
                };
                return <Field key={head} label={<Copy locale={locale}>{head}</Copy>}>{values[head]}</Field>;
              })}
            </dl>
            <details className={styles.calculation}><summary><Copy locale={locale}>Show calculation</Copy></summary><p><Bilingual locale={locale} arabic={null} english={criterion.calculation_trace || reviewText(locale, "No calculation trace was stored.")} /></p></details>
            <SourceRefs ids={criterion.source_ids} numbers={sources} locale={locale} />
          </article>
        ))}
      </div>
    </div>}</>
  );
}

export function ExplanationSlot({ explanation, locale }: { explanation: NonNullable<PublicStockData["explanation"]>; locale: Locale }) {
  const validEnglish = locale === "en" && explanation.validation_status === "passed" && Boolean(explanation.ai_text);
  return (
    <section className={styles.section} data-section="explanation" aria-labelledby="stock-explanation-title">
      <div className={styles.sectionHeading}><h2 id="stock-explanation-title"><Copy locale={locale}>AI explanation</Copy></h2></div>
      {!validEnglish ? (
        <div className={styles.structuredNotice}>
          <h3><Copy locale={locale}>{locale === "ar" && explanation.validation_status === "passed" && explanation.ai_text
            ? "Arabic narrative is not available; structured evidence only."
            : locale === "en" && explanation.validation_status === "failed"
              ? "AI text discarded — showing structured evidence only"
              : "No validated narrative text is stored; structured evidence only."}</Copy></h3>
          {locale === "en" && explanation.validation_status === "failed" && <p><Copy locale={locale}>The generated text did not pass validation against the engine&apos;s evidence, so it was discarded. Every figure below comes straight from the engine.</Copy></p>}
        </div>
      ) : (
        <div className={styles.aiText}><p className={styles.validationNote}><Copy locale={locale}>Every figure in this text was checked against the engine&apos;s evidence.</Copy></p>{stripPublicReviewMarker(explanation.ai_text ?? "")}</div>
      )}
      {((explanation.evidence ?? []).length > 0 || (explanation.unknowns ?? []).length > 0) && (
        <div className={styles.explanationStructured}>
          <h3><Copy locale={locale}>Structured evidence</Copy></h3>
          {(explanation.evidence ?? []).map((entry, index) => <div className={styles.structuredEntry} key={`evidence-${index}`}><StructuredValue value={entry} locale={locale} /></div>)}
          {(explanation.unknowns ?? []).map((entry, index) => <div className={styles.structuredEntry} key={`unknown-${index}`}><StructuredValue value={entry} locale={locale} /></div>)}
        </div>
      )}
    </section>
  );
}
