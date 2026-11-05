import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { displayLabel, type LabelFamily } from "@/i18n/presentation";
import { useTranslations } from "next-intl";
import { ExampleMethodologyBanner, PublicLocalizedText as LocalizedText, Num } from "../foundation";
import { Link } from "../../i18n/navigation";
import type { JsonValue } from "../../db/schema/types";
import type { PublicMethodologyPageData } from "../../db/methodology-public";
import { formatMethodologyDate, MethodologyCopy } from "./MethodologyCopy";
import { lineItemFamily, lineItemLabel, structuredKeyLabel, structuredValueLabel } from "./structured-labels";
import { stripPublicReviewMarker } from "../foundation/shared";
import { publicMethodologyVersionLabel } from "@/i18n/methodology-labels";
import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";
import { isDraftMethodologyLabel, methodologyDisplay } from "@/i18n/methodology-display";

function Field({
  label,
  children,
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 border-t border-[var(--divider)] pt-3 ${className}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-2 break-words text-sm leading-6">{children}</dd>
    </div>
  );
}

function StoredValue({ value, locale, family }: { value: JsonValue; locale: "ar" | "en"; family?: LabelFamily }) {
  if (value === null) return <span>{methodologyDisplay("null", locale)}</span>;
  if (typeof value === "string") {
    const mapped = uiOneDisplay(value, locale) !== value
      ? uiOneDisplay(value, locale)
      : family
        ? displayLabel(family, value, locale)
        : structuredValueLabel("", value, locale) ?? value;
    return <span className="whitespace-pre-wrap">{stripPublicReviewMarker(methodologyDisplay(mapped, locale))}</span>;
  }
  if (typeof value === "number") return <Num>{formatNumber(value, "en", { maximumFractionDigits: 8 })}</Num>;
  if (typeof value === "boolean") {
    const mapped = structuredValueLabel("", value, locale) ?? String(value);
    return <span>{methodologyDisplay(mapped, locale)}</span>;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? <span>—</span> : (
      <ul className="space-y-1">
        {value.map((entry, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden="true" className="text-[var(--byline)]">—</span>
            <StoredValue value={entry} locale={locale} family={family} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return <span>{"{}"}</span>;
  return (
    <dl className="space-y-3">
      {entries.map(([key, entry]) => (
        <div key={key} className="grid gap-1 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] sm:gap-4">
          <dt className="break-words text-xs text-muted-foreground">{methodologyDisplay(structuredKeyLabel(key, locale), locale)}</dt>
          <dd className="min-w-0">
            {typeof entry === "string"
              ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(methodologyDisplay(
                uiOneDisplay(entry, locale) !== entry ? uiOneDisplay(entry, locale) : structuredValueLabel(key, entry, locale) ?? entry,
                locale,
              ))}</span>
              : <StoredValue value={entry} locale={locale} family={lineItemFamily(key)} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StringList({ values, locale }: { values: string[]; locale: "ar" | "en" }) {
  if (values.length === 0) return <span>—</span>;
  return (
    <ul className="space-y-1">
      {values.map((value, index) => (
        <li key={`${value}-${index}`} className="flex gap-2">
          <span aria-hidden="true" className="text-[var(--byline)]">—</span>
          <span className="break-words text-sm">{methodologyDisplay(uiOneDisplay(value, locale) !== value ? uiOneDisplay(value, locale) : lineItemLabel(value, locale), locale)}</span>
        </li>
      ))}
    </ul>
  );
}

function hasEnglishProse(value: string | null | undefined) {
  const text = stripPublicReviewMarker(value?.trim() ?? "");
  if (!text || /[\p{Script=Arabic}]/u.test(text) || !/[A-Za-z]/.test(text)) return false;
  if (/^[A-Z0-9]+(?:[._:/+-][A-Z0-9]+)*$/.test(text)) return false;
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(text)) return false;
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(text)) return false;
  return (text.split(/\s+/).length >= 3 && /[.!?](?:\s|$)/.test(text)) || text.split(/\s+/).length >= 8;
}

function hasEnglishEvidence(value: JsonValue, locale: "ar" | "en"): boolean {
  if (typeof value === "string") return hasEnglishProse(methodologyDisplay(value, locale));
  if (Array.isArray(value)) return value.some(entry => hasEnglishEvidence(entry, locale));
  if (value && typeof value === "object") return Object.entries(value)
    .filter(([key]) => !/^(?:label|name|title|source_title|source_reference)$/i.test(key))
    .some(([, entry]) => hasEnglishEvidence(entry, locale));
  return false;
}

function safeSourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function MethodologyDetail({
  methodology: storedMethod,
  version: storedVersion,
  criteria: storedCriteria,
  locale,
}: {
  methodology: PublicMethodologyPageData["methodology"];
  version: PublicMethodologyPageData["documents"][number]["version"];
  criteria: PublicMethodologyPageData["documents"][number]["criteria"];
  locale: string;
}) {
  const t = useTranslations("methodologies");
  const stock = useTranslations("stock");
  const appT = useTranslations("methodology");
  const publicText = useTranslations("publicMethodology");
  const labelLocale = locale === "ar" ? "ar" : "en";
  const display = (value: string | null) => value === null ? null : methodologyDisplay(value, labelLocale);
  const method = { ...storedMethod, name: display(storedMethod.name)!, short_label: display(storedMethod.short_label),
    publisher: display(storedMethod.publisher), scope: display(storedMethod.scope),
    verified_by: display(storedMethod.verified_by) };
  const version = { ...storedVersion, version_label: display(storedVersion.version_label),
    changelog: display(storedVersion.changelog) };
  const criteria = storedCriteria.map(criterion => {
    const explanations = criterion as typeof criterion & { explanation_ar?: string | null; explanation_en?: string | null };
    return { ...criterion, label: display(criterion.label)!,
      definition: display(criterion.definition), formula_text: display(criterion.formula_text),
      numerator_definition: display(criterion.numerator_definition), denominator_definition: display(criterion.denominator_definition),
      treatment_rules: display(criterion.treatment_rules), edge_cases: display(criterion.edge_cases),
      source_reference: display(criterion.source_reference),
      explanation: display(labelLocale === "ar" ? explanations.explanation_ar ?? null : explanations.explanation_en ?? explanations.explanation_ar ?? null) };
  });
  const sourceUrl = safeSourceUrl(method.source_url);
  const example = method.official_or_inspired === "internal_example" || method.is_demo || version.is_demo;
  const isDraft = isDraftMethodologyLabel(storedVersion.version_label);
  const englishOnlyRemains = labelLocale === "ar" && (
    hasEnglishProse(method.scope) ||
    hasEnglishProse(version.changelog) ||
    hasEnglishEvidence((storedVersion.purification_treatment ?? null) as unknown as JsonValue, labelLocale) ||
    criteria.some(criterion => {
      return [criterion.definition, criterion.formula_text, criterion.numerator_definition,
        criterion.denominator_definition, criterion.treatment_rules, criterion.edge_cases,
        criterion.source_reference, criterion.explanation,
        ...criterion.numerator_line_items.map(value => methodologyDisplay(value, labelLocale)),
        ...criterion.denominator_line_items.map(value => methodologyDisplay(value, labelLocale)),
        ...criterion.required_inputs.map(value => methodologyDisplay(value, labelLocale))].some(hasEnglishProse) ||
        (criterion.treatment_rule_data != null &&
          hasEnglishEvidence(criterion.treatment_rule_data as unknown as JsonValue, labelLocale));
    })
  );
  const headingId = `methodology-${method.slug}-version-${encodeURIComponent(version.version)}`;
  const versionLabel = storedVersion.version_label
    ? methodologyDisplay(publicMethodologyVersionLabel(uiOneDisplay(storedVersion.version_label, labelLocale)), labelLocale)
    : null;

  return (
    <article id={headingId} aria-labelledby={`${headingId}-title`} className="mx-auto min-h-[55vh] max-w-6xl px-5 pb-20 pt-8 sm:px-8 lg:pt-12">
      <nav aria-label={publicText("breadcrumb")} className="mb-8 text-sm text-muted-foreground">
        <Link href="/methodology" className="underline decoration-[var(--divider)] underline-offset-4 hover:text-foreground">
          <LocalizedText>{t("title")}</LocalizedText>
        </Link>
        <span aria-hidden="true" className="mx-3">/</span>
        <span aria-current="page" className="text-foreground">{stripPublicReviewMarker(method.name)}</span>
      </nav>

      {example && (
        <div className="mb-8 border-s-2 border-[var(--brass)] bg-card px-5 py-4">
          <ExampleMethodologyBanner />
        </div>
      )}

      <header className="border-b border-[var(--divider)] pb-9">
        <div>
          <p className="mb-4 text-sm text-[var(--byline)]">
            {methodologyDisplay(displayLabel("methodType", method.type, labelLocale), labelLocale)}
          </p>
          <h1 id={`${headingId}-title`} className="max-w-4xl text-2xl leading-snug sm:text-5xl">{stripPublicReviewMarker(method.name)}</h1>
          {method.short_label && <p className="mt-2 text-[var(--brass-soft)]">{stripPublicReviewMarker(method.short_label)}</p>}
          {method.scope && <p className="mt-5 max-w-3xl text-base text-muted-foreground">{stripPublicReviewMarker(method.scope)}</p>}
          {isDraft && (
            <p className="mt-5 max-w-3xl border-s-2 border-[var(--brass)] ps-4 text-sm leading-6">
              <LocalizedText>{publicText("provisionalNotice")}</LocalizedText>
            </p>
          )}
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            <LocalizedText>{appT("pageNote")}</LocalizedText>
          </p>
          <p className="mt-5 flex max-w-3xl flex-wrap items-center gap-3 border border-[var(--divider)] px-3 py-2">
            <span className="text-xs text-muted-foreground"><LocalizedText>{t("version")}</LocalizedText></span>
             {versionLabel
               ? <span className="text-sm text-[var(--brass-soft)]">{stripPublicReviewMarker(versionLabel)}</span>
               : <Num className="text-sm text-[var(--brass-soft)]">{version.version}</Num>}
             {isDraft && (
               <span className="basis-full border-t border-[var(--divider)] pt-2 text-sm text-[var(--brass-soft)]">
                 <LocalizedText>{publicText("draftReview")}</LocalizedText>
               </span>
             )}
          </p>
        </div>
      </header>

      <details className="group border-b border-[var(--divider)] py-5">
        <summary id={`method-meta-${version.id}`} className="flex cursor-pointer items-center justify-between gap-4 text-lg">
          <span><LocalizedText>{t("sourceDocument")}</LocalizedText></span>
          <span aria-hidden="true" className="ms-2 text-muted-foreground">+</span>
        </summary>
        <dl className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={<LocalizedText>{t("publisher")}</LocalizedText>}>{stripPublicReviewMarker(method.publisher ?? "—")}</Field>
          <Field label={<LocalizedText>{t("officialOrAdapted")}</LocalizedText>}>
            {methodologyDisplay(displayLabel("methodSource", method.official_or_inspired, labelLocale), labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("licensing")}</LocalizedText>}>
            {methodologyDisplay(displayLabel("licence", method.licensing_status, labelLocale), labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("sourceDocument")}</LocalizedText>}>
            {method.source_title ? (
              sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline decoration-[var(--brass)] underline-offset-4 hover:text-[var(--brass-soft)]">
                  {stripPublicReviewMarker(methodologyDisplay(method.source_title, labelLocale))}
                </a>
              ) : stripPublicReviewMarker(methodologyDisplay(method.source_title, labelLocale))
            ) : "—"}
          </Field>
          <Field label={<LocalizedText>{t("verifiedBy")}</LocalizedText>}>{stripPublicReviewMarker(method.verified_by ?? "—")}</Field>
          <Field label={<LocalizedText>{t("verificationDate")}</LocalizedText>}>
            <bdi>{formatMethodologyDate(method.verification_date, locale)}</bdi>
          </Field>
          <Field label={<LocalizedText>{t("productionStatus")}</LocalizedText>}>
            <LocalizedText>{isDraft && method.production_enabled && version.production_enabled
              ? publicText("draftReview")
              : method.production_enabled && version.production_enabled
                ? t("inProduction")
                : t("notInProduction")}</LocalizedText>
          </Field>
          <Field label={<LocalizedText>{t("version")}</LocalizedText>}>
            {versionLabel ? stripPublicReviewMarker(versionLabel) : <Num>{version.version}</Num>}
          </Field>
          <Field label={<LocalizedText>{t("effectiveDate")}</LocalizedText>}>
            <bdi>{formatMethodologyDate(version.effective_date, locale)}</bdi>
          </Field>
          <Field label={<MethodologyCopy id="workflowStatus" />}>
            {methodologyDisplay(displayLabel("workflow", version.workflow_status, labelLocale), labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("changeHistory")}</LocalizedText>} className="sm:col-span-2 lg:col-span-3">
            {version.changelog ? <p className="whitespace-pre-wrap"><LocalizedText>{version.changelog}</LocalizedText></p> : <LocalizedText>{t("noChangeHistory")}</LocalizedText>}
          </Field>
        </dl>
      </details>

      {version.purification_treatment != null && (
        <details className="border-b border-[var(--divider)] py-5">
          <summary id={`purification-${version.id}`} className="flex cursor-pointer items-center justify-between gap-4 text-lg">
            {typeof version.purification_treatment.label === "string"
              ? methodologyDisplay(version.purification_treatment.label, labelLocale)
              : <MethodologyCopy id="purificationTreatment" />}
            <span aria-hidden="true" className="ms-2 text-muted-foreground">+</span>
          </summary>
          <div className="mt-5 max-w-4xl">
            <StoredValue value={version.purification_treatment as unknown as JsonValue} locale={labelLocale} />
          </div>
        </details>
      )}

      {englishOnlyRemains && (
        <p data-language-notice className="mt-5 max-w-4xl text-xs text-muted-foreground">
          <LocalizedText>{publicText("englishOnlyNote")}</LocalizedText>
        </p>
      )}

      <section aria-labelledby={`criteria-${version.id}`} className="pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--divider)] pb-5">
          <div>
            <h2 id={`criteria-${version.id}`} className="mt-2 text-xl sm:text-3xl">
              <LocalizedText>{t("ruleGroups")}</LocalizedText>
            </h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {locale === "ar" ? t("rules", { count: criteria.length, displayCount: formatNumber(criteria.length, "ar") }) : <>
              <Num>{formatNumber(criteria.length, "en")}</Num>
              <span className="ms-2"><LocalizedText>{t("rules")}</LocalizedText></span>
            </>}
          </span>
        </div>

        {criteria.length === 0 ? (
          <div className="border border-dashed border-[var(--divider)] px-5 py-8 text-sm text-muted-foreground">
            <MethodologyCopy id="noPublicCriteria" />
          </div>
        ) : (
          <ol className="space-y-5">
            {criteria.map((criterion, index) => (
              <li key={criterion.id} className="border border-[var(--divider)] bg-card">
                <div className="px-5 py-5 sm:px-7">
                  <div className="flex items-start gap-4">
                    <Num className="pt-1 text-sm text-[var(--byline)]">{String(index + 1).padStart(2, "0")}</Num>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg leading-snug">{stripPublicReviewMarker(methodologyDisplay(uiOneDisplay(criterion.label, labelLocale), labelLocale))}</h3>
                        </div>
                      </div>
                      {criterion.explanation && (
                        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {stripPublicReviewMarker(criterion.explanation)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--divider)] pt-4 text-sm">
                    <span className="text-xs text-muted-foreground"><LocalizedText>{stock("threshold")}</LocalizedText></span>
                    <span className="font-medium">
                      {criterion.threshold === null ? methodologyDisplay("null", labelLocale) : <Num>{criterion.threshold}</Num>}
                    </span>
                    {criterion.threshold !== null && <>
                      <span className="text-muted-foreground">{methodologyDisplay(displayLabel("thresholdUnit", criterion.threshold_unit, labelLocale), labelLocale)}</span>
                      <span className="text-muted-foreground">{methodologyDisplay(displayLabel("direction", criterion.threshold_direction, labelLocale), labelLocale)}</span>
                    </>}
                  </p>
                  <details className="mt-5 border-t border-[var(--divider)] pt-4">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm">
                      <span><LocalizedText>{publicText("technicalDetails")}</LocalizedText></span>
                      <span aria-hidden="true" className="ms-2 text-muted-foreground">+</span>
                    </summary>
                    <dl className="mt-3 grid gap-x-8 gap-y-5 px-1 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label={<MethodologyCopy id="criterionType" />}>
                        {methodologyDisplay(displayLabel("criterionType", criterion.criterion_type, labelLocale), labelLocale)}
                      </Field>
                      <Field label={<LocalizedText>{t("effectiveDate")}</LocalizedText>}>
                        <bdi>{formatMethodologyDate(criterion.effective_date, locale)}</bdi>
                      </Field>
                      <Field label={<MethodologyCopy id="thresholdUnit" />}>
                        {methodologyDisplay(displayLabel("thresholdUnit", criterion.threshold_unit, labelLocale), labelLocale)}
                      </Field>
                      <Field label={<MethodologyCopy id="thresholdDirection" />}>
                        {methodologyDisplay(displayLabel("direction", criterion.threshold_direction, labelLocale), labelLocale)}
                      </Field>
                      <Field label={<LocalizedText>{t("definition")}</LocalizedText>} className="lg:col-span-3">
                        {criterion.definition ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.definition)}</span> : "—"}
                      </Field>
                      <Field label={<LocalizedText>{t("formula")}</LocalizedText>}>
                        {criterion.formula_text ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.formula_text)}</span> : "—"}
                      </Field>
                      <Field label={<LocalizedText>{stock("numerator")}</LocalizedText>}>
                        {criterion.numerator_definition ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.numerator_definition)}</span> : "—"}
                      </Field>
                      <Field label={<LocalizedText>{stock("denominator")}</LocalizedText>}>
                        {criterion.denominator_definition ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.denominator_definition)}</span> : "—"}
                      </Field>
                      <Field label={<MethodologyCopy id="numeratorLineItems" />}>
                        <StringList values={criterion.numerator_line_items} locale={labelLocale} />
                      </Field>
                      <Field label={<MethodologyCopy id="denominatorLineItems" />}>
                        <StringList values={criterion.denominator_line_items} locale={labelLocale} />
                      </Field>
                      <Field label={<LocalizedText>{t("treatment")}</LocalizedText>}>
                        {criterion.treatment_rules ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.treatment_rules)}</span> : "—"}
                      </Field>
                      <Field label={<MethodologyCopy id="treatmentRuleData" />}>
                        {criterion.treatment_rule_data != null
                          ? <StoredValue value={criterion.treatment_rule_data as unknown as JsonValue} locale={labelLocale} />
                          : "—"}
                      </Field>
                      <Field label={<LocalizedText>{t("edgeCases")}</LocalizedText>}>
                        {criterion.edge_cases ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.edge_cases)}</span> : "—"}
                      </Field>
                      <Field label={<LocalizedText>{t("borderline")}</LocalizedText>}>
                        {criterion.borderline_margin === null ? <LocalizedText>{stock("noMarginDefined")}</LocalizedText> : <Num>{criterion.borderline_margin}</Num>}
                      </Field>
                      <Field label={<LocalizedText>{t("requiredInputs")}</LocalizedText>}>
                        <StringList values={criterion.required_inputs} locale={labelLocale} />
                      </Field>
                      <Field label={<LocalizedText>{t("sourceRef")}</LocalizedText>}>
                        {criterion.source_reference ? <span className="whitespace-pre-wrap">{stripPublicReviewMarker(criterion.source_reference)}</span> : "—"}
                      </Field>
                    </dl>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
