"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { ChevronDown, Save, Trash2 } from "lucide-react";
import { categories, lineItems, requiredInputs } from "@/lib/methodology/selectors";
import type { CriterionData } from "@/lib/methodology/contracts";
import type { MethodologyAdminData } from "@/lib/methodology/admin-data";
import { governedText, GovernedCopy, type GovernedKey } from "./GovernedCopy";
import { displayLabel, type LabelFamily } from "@/i18n/presentation";
import { enumDisplayLabel } from "./structured-labels";

type Metadata = {
  name: string; short_label: string | null; slug: string;
  type: "equity_screening" | "fund_screening" | "portfolio_screening";
  publisher: string | null; source_title: string | null; source_url: string | null;
  official_or_inspired: "official" | "adapted" | "internal_example";
  licensing_status: "licensed" | "public_document" | "unlicensed_adapted" | "internal" | "unknown";
  verified_by: string | null; verification_date: string | null; scope: string | null; notes: string | null;
};
type VersionData = {
  version: string; version_label: string | null; effective_date: string | null;
  changelog: string | null; notes: string | null; purification_treatment: Record<string, unknown> | null;
  is_public: boolean;
};
type MetadataRow = MethodologyAdminData["methodologies"][number];
type VersionRow = MethodologyAdminData["versions"][number];
type CriterionRow = MethodologyAdminData["criteria"][number];

const criterionTypes: CriterionData["criterion_type"][] = [
  "business_activity", "non_permissible_revenue", "interest_bearing_debt",
  "cash_and_investments", "receivables", "custom_ratio",
];
const thresholdUnits: CriterionData["threshold_unit"][] = [
  "percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap", "boolean", "absolute",
];
const thresholdDirections: CriterionData["threshold_direction"][] = ["max", "min", "boolean"];

const nullable = (value: string | null | undefined) => value ?? "";
const optionalValue = (value: string) => value.trim() === "" ? null : value;
const arrayToggle = <T extends string,>(values: T[], item: T, checked: boolean) =>
  checked ? [...new Set([...values, item])] : values.filter((value) => value !== item);
type DisplayFamily = Exclude<LabelFamily, "structured">;

function EnumLabel({ family, value, locale }: { family: DisplayFamily; value: string; locale: "ar" | "en" }) {
  return <bdi>{enumDisplayLabel(family, value, locale)}</bdi>;
}

function TextField({
  id, label, value, onChange, type = "text", required = false, dir,
}: {
  id: string; label: GovernedKey; value: string; onChange: (value: string) => void;
  type?: string; required?: boolean; dir?: "ltr" | "rtl";
}) {
  return (
    <label htmlFor={id} className="block min-w-0 text-sm">
      <span className="mb-1.5 block text-xs text-muted-foreground"><GovernedCopy id={label} /></span>
      <input id={id} type={type} required={required} value={value} dir={dir}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full border border-input bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />
    </label>
  );
}

function TextArea({
  id, label, value, onChange, rows = 3, hint,
}: {
  id: string; label: GovernedKey; value: string; onChange: (value: string) => void;
  rows?: number; hint?: ReactNode;
}) {
  return (
    <label htmlFor={id} className="block min-w-0 text-sm">
      <span className="mb-1.5 block text-xs text-muted-foreground"><GovernedCopy id={label} /></span>
      <textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full border border-input bg-background p-3 text-sm leading-6 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />
      {hint && <span className="mt-1 block text-xs leading-5 text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SelectField({
  id, label, value, onChange, options, family,
}: {
  id: string; label: GovernedKey; value: string; onChange: (value: string) => void;
  options: readonly string[]; family: DisplayFamily;
}) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  return (
    <label htmlFor={id} className="block min-w-0 text-sm">
      <span className="mb-1.5 block text-xs text-muted-foreground"><GovernedCopy id={label} /></span>
      <span className="relative block">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-full appearance-none border border-input bg-background px-3 pe-10 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          {options.map((option) => <option key={option} value={option}><EnumLabel family={family} value={option} locale={locale} /></option>)}
        </select>
        <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </span>
    </label>
  );
}

function CheckSet<T extends string>({
  label, options, selected, onChange, family, columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  label: GovernedKey; options: readonly T[]; selected: T[]; onChange: (selected: T[]) => void;
  family?: LabelFamily; columns?: string;
}) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs text-muted-foreground"><GovernedCopy id={label} /></legend>
      <div className={`grid max-h-64 gap-1 overflow-y-auto border border-border bg-background p-2 ${columns}`}>
        {options.map((option) => (
          <label key={option} className="flex min-h-9 items-center gap-2 px-2 text-xs hover:bg-secondary">
            <input type="checkbox" checked={selected.includes(option)}
              onChange={(event) => onChange(arrayToggle(selected, option, event.target.checked))}
              className="size-4 accent-primary" />
            {family && family !== "structured"
              ? <span className="break-words"><EnumLabel family={family} value={option} locale={locale} /></span>
              : <span className="break-words">{displayLabel("structured", option, locale)}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FormActions({ pending, onCancel }: { pending: boolean; onCancel?: () => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      {onCancel && <button type="button" onClick={onCancel} disabled={pending} className="min-h-10 border border-border px-4 text-sm hover:bg-secondary"><GovernedCopy id="cancel" /></button>}
      <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Save aria-hidden="true" size={15} strokeWidth={1.6} />
        <GovernedCopy id={pending ? "saving" : "save"} />
      </button>
    </div>
  );
}

export function MetadataForm({
  initial, onSave, pending, onCancel,
}: {
  initial?: MetadataRow; pending: boolean; onSave: (id: string | null, data: Metadata) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<Metadata>({
    name: initial?.name ?? "", short_label: initial?.short_label ?? null, slug: initial?.slug ?? "",
    type: initial?.type ?? "equity_screening", publisher: initial?.publisher ?? null,
    source_title: initial?.source_title ?? null, source_url: initial?.source_url ?? null,
    official_or_inspired: initial?.official_or_inspired ?? "internal_example",
    licensing_status: initial?.licensing_status ?? "unknown", verified_by: initial?.verified_by ?? null,
    verification_date: initial?.verification_date ?? null, scope: initial?.scope ?? null, notes: initial?.notes ?? null,
  });
  const update = (key: keyof Metadata, value: string | null) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(initial?.id ?? null, {
      ...form, short_label: optionalValue(nullable(form.short_label)),
      publisher: optionalValue(nullable(form.publisher)), source_title: optionalValue(nullable(form.source_title)),
      source_url: optionalValue(nullable(form.source_url)), verified_by: optionalValue(nullable(form.verified_by)),
      verification_date: optionalValue(nullable(form.verification_date)),
      scope: optionalValue(nullable(form.scope)), notes: optionalValue(nullable(form.notes)),
    });
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="method-name" label="name" required value={form.name} onChange={(value) => update("name", value)} />
        <TextField id="method-short-label" label="shortLabel" value={nullable(form.short_label)} onChange={(value) => update("short_label", value)} />
        <TextField id="method-slug" label="slug" required value={form.slug} dir="ltr" onChange={(value) => update("slug", value)} />
        <SelectField id="method-type" label="type" value={form.type} onChange={(value) => update("type", value)}
          options={["equity_screening", "fund_screening", "portfolio_screening"]} family="methodType" />
        <TextField id="method-publisher" label="publisher" value={nullable(form.publisher)} onChange={(value) => update("publisher", value)} />
        <TextField id="method-source-title" label="sourceTitle" value={nullable(form.source_title)} onChange={(value) => update("source_title", value)} />
        <TextField id="method-source-url" label="sourceUrl" value={nullable(form.source_url)} dir="ltr" onChange={(value) => update("source_url", value)} />
        <SelectField id="method-official" label="officialOrAdapted" value={form.official_or_inspired}
          onChange={(value) => update("official_or_inspired", value)} options={["official", "adapted", "internal_example"]} family="methodSource" />
        <SelectField id="method-license" label="licensing" value={form.licensing_status}
          onChange={(value) => update("licensing_status", value)} options={["licensed", "public_document", "unlicensed_adapted", "internal", "unknown"]} family="licence" />
        <TextField id="method-verifier" label="verifiedBy" value={nullable(form.verified_by)} onChange={(value) => update("verified_by", value)} />
        <TextField id="method-verification-date" label="verificationDate" type="date" value={nullable(form.verification_date)} onChange={(value) => update("verification_date", value)} />
      </div>
      <TextArea id="method-scope" label="scope" rows={3} value={nullable(form.scope)} onChange={(value) => update("scope", value)} />
      <TextArea id="method-notes" label="notes" rows={3} value={nullable(form.notes)} onChange={(value) => update("notes", value)} />
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

function safeObjectJson(value: unknown) {
  return value == null ? "" : JSON.stringify(value, null, 2);
}
function parseObjectJson(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Expected a JSON object or blank value.");
  return parsed as Record<string, unknown>;
}

export function VersionForm({
  initial, clones, pending, onSave, onCancel,
}: {
  initial?: VersionRow; clones: VersionRow[]; pending: boolean;
  onSave: (id: string | null, cloneId: string | null, data: VersionData) => void; onCancel?: () => void;
}) {
  const locale = useLocale();
  const [form, setForm] = useState<VersionData>({
    version: initial?.version ?? "", version_label: initial?.version_label ?? null,
    effective_date: initial?.effective_date ?? null, changelog: initial?.changelog ?? null,
    notes: initial?.notes ?? null, purification_treatment: initial?.purification_treatment ?? null,
    is_public: initial?.is_public ?? false,
  });
  const [cloneId, setCloneId] = useState("");
  const [purificationJson, setPurificationJson] = useState(() => safeObjectJson(initial?.purification_treatment));
  const [jsonError, setJsonError] = useState("");
  const update = (key: keyof VersionData, value: string | null) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setJsonError("");
    try {
      const treatment = parseObjectJson(purificationJson);
      onSave(initial?.id ?? null, initial ? null : cloneId || null, {
        ...form,
        version_label: optionalValue(nullable(form.version_label)),
        effective_date: optionalValue(nullable(form.effective_date)),
        changelog: optionalValue(nullable(form.changelog)),
        notes: optionalValue(nullable(form.notes)),
        purification_treatment: treatment,
      });
    } catch {
      setJsonError(governedText(locale, "invalidJsonObject"));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="version-number" label="versionNumber" required value={form.version} dir="ltr" onChange={(value) => update("version", value)} />
        <TextField id="version-label" label="versionLabel" value={nullable(form.version_label)} onChange={(value) => update("version_label", value)} />
        <TextField id="version-effective-date" label="effectiveDate" type="date" value={nullable(form.effective_date)} onChange={(value) => update("effective_date", value)} />
        {!initial && (
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs text-muted-foreground"><GovernedCopy id="cloneFrom" /></span>
            <select value={cloneId} onChange={(event) => {
              const nextId = event.target.value;
              setCloneId(nextId);
              const source = clones.find((item) => item.id === nextId);
              if (!source) {
                setForm({
                  version: "", version_label: null, effective_date: null, changelog: null,
                  notes: null, purification_treatment: null, is_public: false,
                });
                setPurificationJson("");
                return;
              }
              setForm({
                version: "",
                version_label: source.version_label,
                effective_date: source.effective_date,
                changelog: source.changelog,
                notes: source.notes,
                purification_treatment: source.purification_treatment,
                is_public: false,
              });
              setPurificationJson(safeObjectJson(source.purification_treatment));
            }} className="min-h-11 w-full border border-input bg-background px-3 text-sm">
              <option value="">{governedText(locale, "blankDraft")}</option>
              {clones.map((version) => <option key={version.id} value={version.id}>{version.version_label ?? version.version} · {displayLabel("workflow", version.workflow_status, locale === "ar" ? "ar" : "en")}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground"><GovernedCopy id="cloneNote" /></span>
          </label>
        )}
      </div>
      <TextArea id="version-changelog" label="changelog" rows={3} value={nullable(form.changelog)} onChange={(value) => update("changelog", value)} />
      <TextArea id="version-notes" label="notes" rows={3} value={nullable(form.notes)} onChange={(value) => update("notes", value)} />
      <TextArea id="version-purification" label="purificationJson" rows={7} value={purificationJson}
        onChange={(value) => { setPurificationJson(value); setJsonError(""); }}
        hint={<GovernedCopy id="purificationHelp" />} />
      {jsonError && <p role="alert" className="text-sm text-[var(--brass-soft)]"><span lang={locale === "ar" ? "en" : undefined} dir={locale === "ar" ? "ltr" : undefined}>{jsonError}</span></p>}
      <p className="text-xs leading-5 text-muted-foreground"><GovernedCopy id="visibilitySeparate" /></p>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

function criterionFromRow(row?: CriterionRow): CriterionData {
  const safeLineItems = (values: unknown): CriterionData["numerator_line_items"] => Array.isArray(values)
    ? values.filter((value): value is typeof lineItems[number] =>
      typeof value === "string" && (lineItems as readonly string[]).includes(value))
    : [];
  const rawTreatment = row?.treatment_rule_data as {
    prohibited_categories?: unknown;
    non_permissible_categories?: unknown;
  } | null;
  const safeCategories = (values: unknown) => Array.isArray(values)
    ? values.filter((value): value is typeof categories[number] =>
      typeof value === "string" && (categories as readonly string[]).includes(value))
    : undefined;
  const numeratorLineItems: CriterionData["numerator_line_items"] = row
    ? safeLineItems(row.numerator_line_items)
    : ["interest_bearing_debt"];
  const denominatorLineItems: CriterionData["denominator_line_items"] = row
    ? safeLineItems(row.denominator_line_items)
    : ["total_assets"];
  return {
    criterion_type: row?.criterion_type ?? "interest_bearing_debt",
    label: row?.label ?? "",
    definition: row?.definition ?? null, formula_text: row?.formula_text ?? null,
    numerator_definition: row?.numerator_definition ?? null, denominator_definition: row?.denominator_definition ?? null,
    numerator_line_items: numeratorLineItems,
    denominator_line_items: denominatorLineItems,
    threshold: row?.threshold ?? null, threshold_unit: row?.threshold_unit ?? "percent_of_total_assets",
    threshold_direction: row?.threshold_direction ?? "max", borderline_margin: row?.borderline_margin ?? null,
    treatment_rules: row?.treatment_rules ?? null,
    treatment_rule_data: rawTreatment ? {
      prohibited_categories: safeCategories(rawTreatment.prohibited_categories),
      non_permissible_categories: safeCategories(rawTreatment.non_permissible_categories),
    } : null,
    edge_cases: row?.edge_cases ?? null, source_reference: row?.source_reference ?? null,
    effective_date: row?.effective_date ?? null, sort_order: row?.sort_order ?? 0, notes: row?.notes ?? null,
  };
}

function configureEvaluator(form: CriterionData, type: CriterionData["criterion_type"]): CriterionData {
  if (type === "business_activity") return {
    ...form, criterion_type: type, numerator_line_items: ["business_segments"], denominator_line_items: [],
    threshold: null, threshold_unit: "boolean", threshold_direction: "boolean",
  };
  if (type === "non_permissible_revenue") return {
    ...form, criterion_type: type, numerator_line_items: ["business_segments"], denominator_line_items: ["total_revenue"],
    threshold_unit: "percent_of_total_revenue", threshold_direction: "max",
  };
  return {
    ...form, criterion_type: type,
    numerator_line_items: form.numerator_line_items.filter((item) => item !== "business_segments").length
      ? form.numerator_line_items.filter((item) => item !== "business_segments") : ["interest_bearing_debt"],
    denominator_line_items: form.denominator_line_items.length ? form.denominator_line_items : ["total_assets"],
    threshold_unit: form.threshold_unit === "boolean" ? "percent_of_total_assets" : form.threshold_unit,
    threshold_direction: form.threshold_direction === "boolean" ? "max" : form.threshold_direction,
  };
}

export function CriterionForm({
  initial, pending, onSave, onDelete, onCancel,
}: {
  initial?: CriterionRow; pending: boolean;
  onSave: (id: string | null, data: CriterionData) => void; onDelete?: () => void; onCancel?: () => void;
}) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const [form, setForm] = useState(() => criterionFromRow(initial));
  const update = <K extends keyof CriterionData,>(key: K, value: CriterionData[K]) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(initial?.id ?? null, {
      ...form,
      definition: optionalValue(nullable(form.definition)),
      formula_text: optionalValue(nullable(form.formula_text)),
      numerator_definition: optionalValue(nullable(form.numerator_definition)),
      denominator_definition: optionalValue(nullable(form.denominator_definition)),
      treatment_rules: optionalValue(nullable(form.treatment_rules)),
      edge_cases: optionalValue(nullable(form.edge_cases)),
      source_reference: optionalValue(nullable(form.source_reference)),
      effective_date: optionalValue(nullable(form.effective_date)),
      notes: optionalValue(nullable(form.notes)),
      treatment_rule_data: form.treatment_rule_data &&
        ((form.treatment_rule_data.prohibited_categories?.length ?? 0) > 0 || (form.treatment_rule_data.non_permissible_categories?.length ?? 0) > 0)
        ? form.treatment_rule_data : null,
    });
  };
  const inputs = requiredInputs(form);
  return (
    <form onSubmit={submit} className="space-y-5">
      {initial && (
        <div className="border-s-2 border-[var(--brass)] bg-background px-4 py-3">
          <p className="text-xs text-muted-foreground"><GovernedCopy id="criterionIdentity" /></p>
          <code className="mt-1 block break-all font-mono text-xs" dir="ltr">{initial.id}</code>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="criterion-type" label="criterionType" value={form.criterion_type}
          onChange={(value) => setForm((old) => configureEvaluator(old, value as CriterionData["criterion_type"]))} options={criterionTypes} family="criterionType" />
        <TextField id="criterion-label" label="label" required value={form.label} onChange={(value) => update("label", value)} />
        <TextField id="criterion-threshold" label="threshold" type="number" value={form.threshold === null ? "" : String(form.threshold)}
          onChange={(value) => update("threshold", value.trim() === "" ? null : Number(value))} />
        <SelectField id="criterion-threshold-unit" label="thresholdUnit" value={form.threshold_unit}
          onChange={(value) => update("threshold_unit", value as CriterionData["threshold_unit"])} options={thresholdUnits} family="thresholdUnit" />
        <SelectField id="criterion-threshold-direction" label="thresholdDirection" value={form.threshold_direction}
          onChange={(value) => update("threshold_direction", value as CriterionData["threshold_direction"])} options={thresholdDirections} family="direction" />
        <TextField id="criterion-margin" label="borderlineMargin" type="number" value={form.borderline_margin === null ? "" : String(form.borderline_margin)}
          onChange={(value) => update("borderline_margin", value.trim() === "" ? null : Number(value))} />
        <TextField id="criterion-sort" label="sortOrder" type="number" value={String(form.sort_order)}
          onChange={(value) => update("sort_order", value.trim() === "" ? 0 : Number(value))} />
        <TextField id="criterion-effective-date" label="effectiveDate" type="date" value={nullable(form.effective_date)}
          onChange={(value) => update("effective_date", optionalValue(value))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextArea id="criterion-definition" label="definition" value={nullable(form.definition)} onChange={(value) => update("definition", optionalValue(value))} />
        <TextArea id="criterion-formula" label="formula" value={nullable(form.formula_text)} onChange={(value) => update("formula_text", optionalValue(value))} />
        <TextArea id="criterion-numerator" label="numeratorDefinition" value={nullable(form.numerator_definition)} onChange={(value) => update("numerator_definition", optionalValue(value))} />
        <TextArea id="criterion-denominator" label="denominatorDefinition" value={nullable(form.denominator_definition)} onChange={(value) => update("denominator_definition", optionalValue(value))} />
      </div>
      {form.criterion_type !== "business_activity" && form.criterion_type !== "non_permissible_revenue" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <CheckSet label="numeratorLineItems" options={lineItems.filter((item) => item !== "business_segments")}
            selected={form.numerator_line_items.filter((item) => item !== "business_segments")}
            onChange={(value) => update("numerator_line_items", value)} family="lineItem" />
          <CheckSet label="denominatorLineItems" options={lineItems.filter((item) => item !== "business_segments")}
            selected={form.denominator_line_items.filter((item) => item !== "business_segments")}
            onChange={(value) => update("denominator_line_items", value)} family="lineItem" />
        </div>
      )}
      {(form.criterion_type === "business_activity" || form.criterion_type === "non_permissible_revenue") && (
        <section className="space-y-4 border border-border p-4">
          <h3 className="text-sm font-medium"><GovernedCopy id="activityCategories" /></h3>
          {form.criterion_type === "business_activity" && (
            <CheckSet label="prohibitedCategories" options={categories} family="activity"
              selected={form.treatment_rule_data?.prohibited_categories ?? []}
              onChange={(values) => update("treatment_rule_data", { ...form.treatment_rule_data, prohibited_categories: values })} />
          )}
          {form.criterion_type === "non_permissible_revenue" && (
            <CheckSet label="nonPermissibleCategories" options={categories} family="activity"
              selected={form.treatment_rule_data?.non_permissible_categories ?? []}
              onChange={(values) => update("treatment_rule_data", { ...form.treatment_rule_data, non_permissible_categories: values })} />
          )}
          <p className="text-xs text-muted-foreground"><GovernedCopy id="requiredActivityItems" /></p>
        </section>
      )}
      <div className="grid gap-3 border border-border bg-background p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted-foreground"><GovernedCopy id="numeratorLineItems" /></p>
          <StringTokens values={form.numerator_line_items} locale={locale} />
        </div>
        <div>
          <p className="mb-2 text-xs text-muted-foreground"><GovernedCopy id="denominatorLineItems" /></p>
          <StringTokens values={form.denominator_line_items} locale={locale} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea id="criterion-treatment" label="treatmentRules" value={nullable(form.treatment_rules)} onChange={(value) => update("treatment_rules", optionalValue(value))} />
        <TextArea id="criterion-edges" label="edgeCases" value={nullable(form.edge_cases)} onChange={(value) => update("edge_cases", optionalValue(value))} />
        <TextField id="criterion-source-ref" label="sourceReference" value={nullable(form.source_reference)} onChange={(value) => update("source_reference", optionalValue(value))} />
        <TextArea id="criterion-notes" label="notes" value={nullable(form.notes)} onChange={(value) => update("notes", optionalValue(value))} />
      </div>
      <div className="border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground"><GovernedCopy id="requiredInputsDerived" /></p>
        <div className="mt-2 flex flex-wrap gap-2">
          {inputs.map((input) => <code key={input} className="border border-border px-2 py-1 font-mono text-[11px]" dir="ltr">{input}</code>)}
          {inputs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {initial && onDelete ? (
          <button type="button" disabled={pending} onClick={onDelete} className="inline-flex min-h-10 items-center gap-2 border border-border px-3 text-sm hover:bg-secondary disabled:opacity-50">
            <Trash2 aria-hidden="true" size={15} strokeWidth={1.6} /><GovernedCopy id="deleteCriterion" />
          </button>
        ) : <span />}
        <FormActions pending={pending} onCancel={onCancel} />
      </div>
    </form>
  );
}

function StringTokens({ values, locale }: { values: string[]; locale: "ar" | "en" }) {
  return values.length ? (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => <span key={value} className="border border-border px-2 py-1 text-xs"><EnumLabel family="lineItem" value={value} locale={locale} /></span>)}
    </div>
  ) : <span className="text-xs text-muted-foreground">—</span>;
}

export function AnalystCasesEditor({
  version, criteria, pending, onSave, readOnly = false,
}: {
  version: VersionRow; criteria: CriterionRow[]; pending: boolean; onSave: (cases: unknown[]) => void; readOnly?: boolean;
}) {
  const existing = Array.isArray(version.analyst_test_cases) ? version.analyst_test_cases : [];
  const [raw, setRaw] = useState(() => JSON.stringify(existing, null, 2));
  const [error, setError] = useState("");
  const locale = useLocale();
  const sample = JSON.stringify([{
    name: "analyst_case_example",
    inputs: {
      securityId: "REPLACE-WITH-SECURITY-ID",
      asOf: "2026-02-28",
      period: { id: "REPLACE-WITH-PERIOD-ID", label: "FY 2025", periodEnd: "2025-12-31" },
      facts: [],
      segments: [],
    },
    expected: {
      criteria: Object.fromEntries(criteria.map((criterion) => [criterion.id, "unknown"])),
      status: "insufficient_data",
    },
  }], null, 2);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Cases must be a JSON array.");
      setError("");
      onSave(parsed);
    } catch {
      setError(governedText(locale, "invalidCasesJson"));
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="border-s-2 border-[var(--brass)] bg-background px-4 py-3 text-sm leading-6 text-muted-foreground">
        <p><GovernedCopy id="caseInstructions" /></p>
        <p className="mt-2"><GovernedCopy id="caseCriteriaHint" /></p>
        {criteria.length === 0 ? <p className="mt-2 text-[var(--brass-soft)]"><GovernedCopy id="addCriteriaFirst" /></p> : (
          <ul className="mt-3 space-y-1">
            {criteria.map((criterion) => (
              <li key={criterion.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <code className="font-mono text-[10px]" dir="ltr">{criterion.id}</code>
                <span>{criterion.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={readOnly} onClick={() => { setRaw(sample); setError(""); }}
          className="min-h-9 border border-border px-3 text-xs hover:bg-secondary"><GovernedCopy id="insertExample" /></button>
      </div>
      <label htmlFor={`cases-${version.id}`} className="block text-xs text-muted-foreground"><GovernedCopy id="analystCasesJson" /></label>
      <textarea id={`cases-${version.id}`} dir="ltr" readOnly={readOnly} spellCheck={false} value={raw} onChange={(event) => { setRaw(event.target.value); setError(""); }}
        rows={18} className="w-full border border-input bg-background p-4 font-mono text-xs leading-5 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />
      {error && <p role="alert" className="text-sm text-[var(--brass-soft)]"><span lang={locale === "ar" ? "en" : undefined} dir={locale === "ar" ? "ltr" : undefined}>{error}</span></p>}
      {!readOnly && <div className="flex justify-end">
        <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          <Save aria-hidden="true" size={15} strokeWidth={1.6} /><GovernedCopy id={pending ? "saving" : "saveCases"} />
        </button>
      </div>}
    </form>
  );
}

export function SourceAssociation({
  version, parent, sources, pending, onAssociate, readOnly = false,
}: {
  version: VersionRow; parent: MetadataRow; sources: MethodologyAdminData["sources"];
  pending: boolean; onAssociate: (sourceId: string) => void; readOnly?: boolean;
}) {
  const locale = useLocale();
  const eligible = sources.filter((item) =>
    !item.is_demo && !item.is_synthetic && !item.production_blocked &&
    item.confidence_tier === "Verified" && !!item.document_title?.trim() &&
    item.source_url?.startsWith("https://") && item.source_url === parent.source_url &&
    !version.source_ids.includes(item.id),
  );
  const associated = sources.filter((item) => version.source_ids.includes(item.id));
  const [sourceId, setSourceId] = useState(eligible[0]?.id ?? "");
  return (
    <div className="space-y-4">
      {associated.length > 0 && (
        <ul className="space-y-2">
          {associated.map((item) => (
            <li key={item.id} className="border border-border bg-background p-3">
              <p className="text-sm">{item.document_title ?? item.label}</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground" dir="ltr">{item.source_url}</p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span>{displayLabel("tier", item.confidence_tier, locale === "ar" ? "ar" : "en")}</span>
                <span lang="en" dir="ltr">{item.is_demo ? "Demo" : "Non-demo"}</span>
                <span lang="en" dir="ltr">{item.is_synthetic ? "Synthetic" : "Not synthetic"}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {version.workflow_status !== "draft" || readOnly ? (
        <p className="text-sm text-muted-foreground"><GovernedCopy id={readOnly ? "editorReadOnly" : "finalizedContentReadOnly"} /></p>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); if (sourceId) onAssociate(sourceId); }} className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1 text-xs text-muted-foreground">
            <span className="mb-1.5 block"><GovernedCopy id="genuineMethodologySource" /></span>
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} disabled={eligible.length === 0}
              className="min-h-11 w-full border border-input bg-background px-3 text-sm text-foreground">
              {eligible.length === 0 ? <option value="">{governedText(locale, "noEligibleSources")}</option> : eligible.map((item) => (
                <option key={item.id} value={item.id}>{item.document_title} · {displayLabel("tier", item.confidence_tier, locale === "ar" ? "ar" : "en")}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending || !sourceId || eligible.length === 0}
            className="min-h-11 self-end bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"><GovernedCopy id="associateSource" /></button>
        </form>
      )}
    </div>
  );
}

