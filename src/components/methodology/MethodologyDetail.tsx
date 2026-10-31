import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { displayLabel, type LabelFamily } from "@/i18n/presentation";
import { useTranslations } from "next-intl";
import { ExampleMethodologyBanner, LocalizedText, Num } from "../foundation";
import { Link } from "../../i18n/navigation";
import type { JsonValue } from "../../db/schema/types";
import type { PublicMethodologyPageData } from "../../db/methodology-public";
import { formatMethodologyDate, MethodologyCopy } from "./MethodologyCopy";
import { lineItemFamily, lineItemLabel, structuredKeyLabel, structuredValueLabel } from "./structured-labels";

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
  if (value === null) return <span lang="en" dir="ltr">null</span>;
  if (typeof value === "string") return <span className="whitespace-pre-wrap">{family ? displayLabel(family, value, locale) : value}</span>;
  if (typeof value === "number") return <Num>{formatNumber(value, "en", { maximumFractionDigits: 8 })}</Num>;
  if (typeof value === "boolean") return <span>{structuredValueLabel("", value, locale)}</span>;
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
          <dt className="break-words text-xs text-muted-foreground">{structuredKeyLabel(key, locale)}</dt>
          <dd className="min-w-0">{typeof entry === "string" ? <span className="whitespace-pre-wrap">{structuredValueLabel(key, entry, locale)}</span> : <StoredValue value={entry} locale={locale} family={lineItemFamily(key)} />}</dd>
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
          <span className="break-words text-sm">{lineItemLabel(value, locale)}</span>
        </li>
      ))}
    </ul>
  );
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
  methodology: method,
  version,
  criteria,
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
  const sourceUrl = safeSourceUrl(method.source_url);
  const example = method.official_or_inspired === "internal_example" || method.is_demo || version.is_demo;
  const headingId = `methodology-${method.slug}-version-${encodeURIComponent(version.version)}`;

  return (
    <article id={headingId} aria-labelledby={`${headingId}-title`} className="mx-auto min-h-[55vh] max-w-6xl px-5 pb-20 pt-8 sm:px-8 lg:pt-12">
      <nav aria-label={publicText("breadcrumb")} className="mb-8 text-sm text-muted-foreground">
        <Link href="/methodology" className="underline decoration-[var(--divider)] underline-offset-4 hover:text-foreground">
          <LocalizedText>{t("title")}</LocalizedText>
        </Link>
        <span aria-hidden="true" className="mx-3">/</span>
        <span aria-current="page" className="text-foreground">{method.name}</span>
      </nav>

      {example && (
        <div className="mb-8 border-s-2 border-[var(--brass)] bg-card px-5 py-4">
          <ExampleMethodologyBanner />
        </div>
      )}

      <header className="border-b border-[var(--divider)] pb-9">
        <div>
          <p className="mb-4 text-sm text-[var(--byline)]">
            {displayLabel("methodType", method.type, labelLocale)}
          </p>
          <h1 id={`${headingId}-title`} className="max-w-4xl text-4xl leading-tight sm:text-5xl">{method.name}</h1>
          {method.short_label && <p className="mt-2 text-[var(--brass-soft)]">{method.short_label}</p>}
          {method.scope && <p className="mt-5 max-w-3xl text-base text-muted-foreground">{method.scope}</p>}
          <p className="mt-5 max-w-3xl border-s-2 border-[var(--brass)] ps-4 text-sm leading-6">
            <LocalizedText>{appT("pageNote")}</LocalizedText>
          </p>
          <p className="mt-5 inline-flex items-center gap-3 border border-[var(--divider)] px-3 py-2">
            <span className="text-xs text-muted-foreground"><LocalizedText>{t("version")}</LocalizedText></span>
             {version.version_label
               ? <span className="text-sm text-[var(--brass-soft)]">{version.version_label}</span>
               : <Num className="text-sm text-[var(--brass-soft)]">{version.version}</Num>}
          </p>
        </div>
      </header>

      <section aria-labelledby={`method-meta-${version.id}`} className="py-9">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id={`method-meta-${version.id}`} className="text-2xl">
            <LocalizedText>{t("sourceDocument")}</LocalizedText>
          </h2>
          {version.version_label
            ? <span className="text-sm text-[var(--brass-soft)]">{version.version_label}</span>
            : <span className="font-mono text-sm text-[var(--brass-soft)]" dir="ltr">{version.version}</span>}
        </div>
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={<LocalizedText>{t("publisher")}</LocalizedText>}>{method.publisher ?? "—"}</Field>
          <Field label={<LocalizedText>{t("officialOrAdapted")}</LocalizedText>}>
            {displayLabel("methodSource", method.official_or_inspired, labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("licensing")}</LocalizedText>}>
            {displayLabel("licence", method.licensing_status, labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("sourceDocument")}</LocalizedText>}>
            {method.source_title ? (
              sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-[var(--brass)] underline-offset-4 hover:text-[var(--brass-soft)]">
                  {method.source_title}
                </a>
              ) : method.source_title
            ) : "—"}
          </Field>
          <Field label={<LocalizedText>{t("verifiedBy")}</LocalizedText>}>{method.verified_by ?? "—"}</Field>
          <Field label={<LocalizedText>{t("verificationDate")}</LocalizedText>}>
            <bdi>{formatMethodologyDate(method.verification_date, locale)}</bdi>
          </Field>
          <Field label={<LocalizedText>{t("productionStatus")}</LocalizedText>}>
            <LocalizedText>{method.production_enabled && version.production_enabled ? t("inProduction") : t("notInProduction")}</LocalizedText>
          </Field>
          <Field label={<LocalizedText>{t("version")}</LocalizedText>}>
            {version.version_label ? version.version_label : <Num>{version.version}</Num>}
          </Field>
          <Field label={<LocalizedText>{t("effectiveDate")}</LocalizedText>}>
            <bdi>{formatMethodologyDate(version.effective_date, locale)}</bdi>
          </Field>
          <Field label={<MethodologyCopy id="workflowStatus" />}>
            {displayLabel("workflow", version.workflow_status, labelLocale)}
          </Field>
          <Field label={<LocalizedText>{t("changeHistory")}</LocalizedText>} className="sm:col-span-2 lg:col-span-3">
            {version.changelog ? <p className="whitespace-pre-wrap">{version.changelog}</p> : <LocalizedText>{t("noChangeHistory")}</LocalizedText>}
          </Field>
        </dl>
      </section>

      {version.purification_treatment != null && (
        <section aria-labelledby={`purification-${version.id}`} className="border-y border-[var(--divider)] py-8">
          <p className="text-sm text-[var(--byline)]">
            <MethodologyCopy id="storedMethodologyData" />
          </p>
          <h2 id={`purification-${version.id}`} className="mt-2 text-2xl">
            {typeof version.purification_treatment.label === "string"
              ? version.purification_treatment.label
              : <MethodologyCopy id="purificationTreatment" />}
          </h2>
          <div className="mt-5 max-w-4xl">
            <StoredValue value={version.purification_treatment as unknown as JsonValue} locale={labelLocale} />
          </div>
        </section>
      )}

      <section aria-labelledby={`criteria-${version.id}`} className="pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--divider)] pb-5">
          <div>
            <p className="text-sm text-[var(--byline)]">
              <MethodologyCopy id="ruleRegister" />
            </p>
            <h2 id={`criteria-${version.id}`} className="mt-2 text-3xl">
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

        {criteria.length > 0 && (
          <div className="mb-8 overflow-x-auto border border-[var(--divider)] bg-card">
            <table className="w-full min-w-[760px] border-collapse text-start text-sm">
              <caption className="border-b border-[var(--divider)] px-4 py-3 text-start text-xs text-muted-foreground">
                <MethodologyCopy id="criteriaSummaryTable" />
              </caption>
              <thead className="bg-background text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><LocalizedText>{stock("criterion")}</LocalizedText></th>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><MethodologyCopy id="criterionType" /></th>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><LocalizedText>{stock("threshold")}</LocalizedText></th>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><MethodologyCopy id="thresholdUnit" /></th>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><MethodologyCopy id="thresholdDirection" /></th>
                  <th scope="col" className="px-4 py-3 text-start font-medium"><LocalizedText>{t("borderline")}</LocalizedText></th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((criterion) => (
                  <tr key={criterion.id} className="border-t border-[var(--divider)]">
                    <th scope="row" className="px-4 py-3 text-start font-medium">{criterion.label}</th>
                    <td className="px-4 py-3 text-xs">{displayLabel("criterionType", criterion.criterion_type, labelLocale)}</td>
                    <td className="px-4 py-3 font-mono" dir="ltr">
                      {criterion.threshold === null ? <span>null</span> : <Num>{criterion.threshold}</Num>}
                    </td>
                    <td className="px-4 py-3 text-xs">{displayLabel("thresholdUnit", criterion.threshold_unit, labelLocale)}</td>
                    <td className="px-4 py-3 text-xs">{displayLabel("direction", criterion.threshold_direction, labelLocale)}</td>
                    <td className="px-4 py-3 text-sm">
                      {criterion.borderline_margin === null ? (
                        <LocalizedText>{stock("noMarginDefined")}</LocalizedText>
                      ) : <Num>{criterion.borderline_margin}</Num>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {criteria.length === 0 ? (
          <div className="border border-dashed border-[var(--divider)] px-5 py-8 text-sm text-muted-foreground">
            <MethodologyCopy id="noPublicCriteria" />
          </div>
        ) : (
          <ol className="space-y-5">
            {criteria.map((criterion, index) => (
              <li key={criterion.id} className="border border-[var(--divider)] bg-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--divider)] px-5 py-4 sm:px-7">
                  <div className="flex gap-4">
                    <Num className="pt-1 text-sm text-[var(--byline)]">{String(index + 1).padStart(2, "0")}</Num>
                    <div>
                      <h3 className="text-lg leading-snug">{criterion.label}</h3>
                      <span className="mt-1 inline-block text-xs text-muted-foreground">
                        {displayLabel("criterionType", criterion.criterion_type, labelLocale)}
                      </span>
                    </div>
                  </div>
                  {criterion.effective_date && (
                    <div className="text-xs text-muted-foreground">
                      <span><LocalizedText>{t("effectiveDate")}</LocalizedText>: </span>
                      <bdi>{formatMethodologyDate(criterion.effective_date, locale)}</bdi>
                    </div>
                  )}
                </div>
                <dl className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-3">
                  <Field label={<LocalizedText>{t("definition")}</LocalizedText>} className="lg:col-span-3">
                    {criterion.definition ?? "—"}
                  </Field>
                  <Field label={<LocalizedText>{t("formula")}</LocalizedText>}>
                    {criterion.formula_text ?? "—"}
                  </Field>
                  <Field label={<LocalizedText>{stock("numerator")}</LocalizedText>}>
                    {criterion.numerator_definition ?? "—"}
                  </Field>
                  <Field label={<LocalizedText>{stock("denominator")}</LocalizedText>}>
                    {criterion.denominator_definition ?? "—"}
                  </Field>
                  <Field label={<MethodologyCopy id="numeratorLineItems" />}>
                    <StringList values={criterion.numerator_line_items} locale={labelLocale} />
                  </Field>
                  <Field label={<MethodologyCopy id="denominatorLineItems" />}>
                    <StringList values={criterion.denominator_line_items} locale={labelLocale} />
                  </Field>
                  <Field label={<LocalizedText>{stock("threshold")}</LocalizedText>}>
                    {criterion.threshold === null ? "—" : <Num>{criterion.threshold}</Num>}
                  </Field>
                  <Field label={<MethodologyCopy id="thresholdUnit" />}>
                    {displayLabel("thresholdUnit", criterion.threshold_unit, labelLocale)}
                  </Field>
                  <Field label={<MethodologyCopy id="thresholdDirection" />}>
                    {displayLabel("direction", criterion.threshold_direction, labelLocale)}
                  </Field>
                  <Field label={<LocalizedText>{t("borderline")}</LocalizedText>}>
                    {criterion.borderline_margin === null ? (
                      <LocalizedText>{stock("noMarginDefined")}</LocalizedText>
                    ) : <Num>{criterion.borderline_margin}</Num>}
                  </Field>
                  <Field label={<LocalizedText>{t("treatment")}</LocalizedText>}>
                    {criterion.treatment_rules ?? "—"}
                  </Field>
                  <Field label={<MethodologyCopy id="treatmentRuleData" />}>
                    {criterion.treatment_rule_data ? (
                      <StoredValue value={criterion.treatment_rule_data as unknown as JsonValue} locale={labelLocale} />
                    ) : "—"}
                  </Field>
                  <Field label={<LocalizedText>{t("edgeCases")}</LocalizedText>}>
                    {criterion.edge_cases ?? "—"}
                  </Field>
                  <Field label={<LocalizedText>{t("requiredInputs")}</LocalizedText>}>
                    <StringList values={criterion.required_inputs} locale={labelLocale} />
                  </Field>
                  <Field label={<LocalizedText>{t("sourceRef")}</LocalizedText>}>
                    {criterion.source_reference ?? "—"}
                  </Field>
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
