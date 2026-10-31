"use client";

import { cloneElement, isValidElement, useId, useMemo, useState, useTransition, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { AlertTriangle, ArrowUpRight, FileCheck2, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { formatDate, formatNumber } from "@/lib/format";
import { completedQuarter, deriveMarketValue, selectMonthEnd } from "@/lib/financial/market-value";
import { reviewText, type Locale } from "@/components/accounts/types";
import { LocalizedText } from "@/components/foundation/shared";
import type { FinancialAdminData, FinancialCommand, FinancialResult, SecurityLookup } from "@/lib/financial/contracts";
import { financialAction } from "@/app/[locale]/(private)/admin/(protected)/financial-actions";
import { ScreeningControls } from "@/components/financial/ScreeningControls";
import type { ScreeningAdminData } from "@/screening/contracts";
import { displayLabel } from "@/i18n/presentation";

type Props = { data: FinancialAdminData; role: "admin" | "editor"; view: "securities" | "ingestion"; screening?: ScreeningAdminData };
type Tab = "facts" | "segments" | "prices" | "coverage" | "company";
const tiers = ["Verified", "Calculated", "Estimated", "AI Interpretation"] as const;
const states = ["reported", "derived", "estimated", "unknown"] as const;
const categories = ["unclassified", "conventional_finance", "interest_based_lending", "insurance_conventional", "alcohol", "tobacco", "gambling", "adult_entertainment", "pork_related", "conventional_media", "weapons_conventional", "generic_permissible", "real_estate_permissible", "technology", "healthcare", "retail_permissible", "industrials", "energy", "telecom"] as const;
// The inventory is intentionally finite: ar-review discovers the literal union
// passed to reviewText here, while all unapproved Arabic remains visibly marked.
const financialCopy = [
  "Accept SEC", "Activity category", "Add a security", "Add segment", "Arabic description", "Arabic name", "Assigned analyst",
  "Cancel", "Category basis", "Close", "Confidence tier", "Confirm and ingest", "Confirm from filing", "Confirm removal",
  "Coverage started", "Currency", "Date", "Delete", "Delete this segment?", "Description", "Edit", "Editors have read-only access.",
  "English description", "English name", "Estimated", "Filing note reference", "In universe", "Ingest now", "Input state",
  "Look up a US ticker before adding it to the curated universe.", "Mapping note", "No", "No analyst assigned",
  "No business segments are recorded for the latest period.", "No facts are recorded for this period.", "No ingestion jobs recorded.",
  "No latest period", "No manual prices are recorded.", "No securities in the curated universe.", "Note",
  "One or more segments are unclassified; classify them using filing evidence.", "Open source", "Origin", "Outside universe",
  "Override", "Preview", "Protected current", "Reason (required)", "Remove from universe",
  "Removing a security keeps its historical records and removes it from the curated universe.", "Resume", "Retained SEC alternatives",
  "Retry", "Revenue amount", "SEC changed", "Save", "Save close", "Save company fields", "Save coverage", "Save segment",
  "Security details", "Security record", "Segment name", "Select a security to inspect its records.",
  "Shares outstanding are unknown or missing. A market-cap fact cannot be derived from a close until shares are available.",
  "Source", "Source URL", "Source label", "Source notes", "Source type",
  "Start a resumable ingestion job for the curated universe, or resume a recorded run below.", "State",
  "The request failed. Reload and try again.", "This security will no longer be part of the curated universe.", "Ticker",
  "Tier", "Unknown", "Value", "Yes", "inactive", "records", "Job", "Status", "Started", "Finished", "Counts", "Actions",
  "Facts", "Segments", "Prices", "Coverage", "Company", "Ingestion", "Securities and data",
  "Job started.", "Retry queued.", "Resume requested.", "Security added and ingestion started.", "Security removed from universe.",
  "Filing confirmation saved.", "Override saved.", "SEC alternative accepted.", "Segment saved.", "Segment deleted.",
  "Manual close saved.", "Coverage assignment saved.", "Saved.", "Failed", "Completed", "Running", "Pending",
  "admin", "editor",
  "Inspect sourced financial records across the curated universe.", "Job history, progress and failed security retries.",
  "Ingestion controls", "Job history", "Security universe", "Analyst coverage", "Company profile", "Universe membership",
  "Current facts", "Business segments", "Manual price history", "CIK", "Name", "Exchange", "Sector", "Fiscal year end",
  "Add prohibited income", "Month-end represented", "Month-end source confirmation",
  "Gross annual prohibited income includes interest income, prohibited-activity revenue and other analyst-identified prohibited income for the displayed annual period. Use a sourced total or a conservative estimate.",
  "Use only when the source explicitly identifies the calendar month-end represented by this close. The close date is its actual last trading day; do not infer an attribution.",
  "Month-end representation must be the calendar month-end in the same month as the close date.",
  "Latest completed quarter", "Attested close", "Required month-end observation", "Missing attested observation",
  "Quarter guidance date is unavailable.",
  "Market value guidance", "Mean of the three attested closes multiplied by latest shares outstanding, compared with mapped equity; use the higher amount. Nonpositive equity uses the average.",
  "Guidance unavailable: all three sourced attested closes, latest shares outstanding and mapped equity are required.",
  "Mapped equity", "Shares outstanding", "Reported", "Calculated amount", "Shared fact", "Selected security",
  "This value is calculated from sourced inputs and cannot be overridden here.", "Use the source's explicit month-end attribution. Do not infer a month-end from the close date.",
] as const;
function text(locale: Locale, value: string) {
  for (const phrase of financialCopy) if (phrase === value) return reviewText(locale, phrase);
  return reviewText(locale, value);
}
const ltr = (value: ReactNode) => <bdi dir="ltr" className="font-mono tabular-nums">{value}</bdi>;
const inputClass = "min-h-10 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[var(--brass)]";
const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 border border-border px-3 text-xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return <div className="grid gap-1.5 text-xs text-muted-foreground"><label htmlFor={id}>{label}</label>{control}</div>;
}
function Panel({ locale, title, children, aside }: { locale: Locale; title: string; children: ReactNode; aside?: ReactNode }) {
  return <section className="border border-border bg-card"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><h2 className="text-base font-semibold">{text(locale, title)}</h2>{aside}</header><div className="p-5">{children}</div></section>;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function FinancialAdmin({ data, role, view, screening }: Props) {
  const router = useRouter();
  const locale = (useLocale() === "en" ? "en" : "ar") as Locale;
  const canEdit = role === "admin";
  const [selectedId, setSelectedId] = useState(data.securities[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("facts");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");
  const [lookupTicker, setLookupTicker] = useState("");
  const [lookup, setLookup] = useState<SecurityLookup>();
  const [lookupError, setLookupError] = useState("");
  const [factEditor, setFactEditor] = useState<{ id: string; mode: "override" | "confirm" } | null>(null);
  const [segmentEditor, setSegmentEditor] = useState<string | "new" | null>(null);
  const [removing, setRemoving] = useState(false);
  const selected = data.securities.find((item) => item.id === selectedId) ?? null;
  const company = selected ? data.companies.find((item) => item.id === selected.company_id) : undefined;
  const periods = useMemo(() => data.periods.filter((item) => item.company_id === selected?.company_id), [data.periods, selected?.company_id]);
  const latestPeriod = periods.find((item) => item.is_latest && item.period_type === "annual") ?? periods.find((item) => item.is_latest);
   const facts = latestPeriod ? data.facts.filter((item) => item.company_id === selected?.company_id && item.period_id === latestPeriod.id &&
     (((item as typeof item & { security_id?: string | null }).security_id ?? null) === null || (item as typeof item & { security_id?: string | null }).security_id === selected?.id)) : [];
  const segments = latestPeriod ? data.segments.filter((item) => item.company_id === selected?.company_id && item.period_id === latestPeriod.id) : [];
  const run = (command: FinancialCommand, success: string, onSuccess?: (result: Extract<FinancialResult, { ok: true }>) => void) => {
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await financialAction(command);
        if (result.ok) {
          setFeedback(text(locale, success));
          onSuccess?.(result);
          router.refresh();
        } else setFeedback(text(locale, result.error || "The request failed. Reload and try again."));
      } catch {
        setFeedback(text(locale, "The request failed. Reload and try again."));
      }
    });
  };
  const submit = (event: FormEvent<HTMLFormElement>, callback: (form: FormData) => void) => {
    event.preventDefault();
    callback(new FormData(event.currentTarget));
  };
  const companyUpdate = (form: FormData) => {
    if (!selected) return;
    run({ operation: "company", securityId: selected.id, data: {
      name_ar: String(form.get("name_ar") ?? ""), description_ar: String(form.get("description_ar") ?? ""), description_en: String(form.get("description_en") ?? ""),
    } }, "Saved.");
  };

  if (view === "ingestion") {
    return <main className="mx-auto max-w-[1280px] space-y-6">
      <Heading locale={locale} role={role} title="Ingestion" intro="Job history, progress and failed security retries." />
      {feedback && <Status locale={locale}>{feedback}</Status>}
      <Panel locale={locale} title="Ingestion controls" aside={canEdit && !screening && <button className={buttonClass} type="button" disabled={pending} onClick={() => run({ operation: "runJob" }, "Job started.")}><RefreshCw size={14} aria-hidden="true" />{text(locale, "Ingest now")}</button>}>
        {!canEdit && <p className="mb-4 text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
        <p className="text-sm leading-6 text-muted-foreground">{text(locale, "Start a resumable ingestion job for the curated universe, or resume a recorded run below.")}</p>
      </Panel>
      {screening && <ScreeningControls data={screening} role={role} ingestion />}
      <Panel locale={locale} title="Job history">
        {data.jobs.length === 0 ? <Empty>{text(locale, "No ingestion jobs recorded.")}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-start text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground">{["Job", "Status", "Started", "Finished", "Counts", "Actions"].map((label) => <th key={label} className="px-3 py-3 text-start font-medium">{text(locale, label)}</th>)}</tr></thead><tbody>{data.jobs.map((job) => {
          const errors = Array.isArray(job.errors) ? job.errors : [];
          const counts = job.counts ?? {};
          return <tr key={job.id} className="border-b border-border align-top">
            <td className="px-3 py-3"><span className="block font-medium">{job.job_name}</span><span className="font-mono text-[10px] text-muted-foreground" dir="ltr">{job.id}</span></td>
            <td className="px-3 py-3">{text(locale, job.status === "running" ? "Running" : job.status)}</td><td className="px-3 py-3 whitespace-nowrap">{formatDate(job.started_at, locale, { dateStyle: "medium", timeStyle: "short" })}</td>
            <td className="px-3 py-3 whitespace-nowrap">{formatDate(job.finished_at, locale, { dateStyle: "medium", timeStyle: "short" })}</td>
            <td className="px-3 py-3"><div className="flex flex-wrap gap-2">{Object.entries(counts).map(([key, count]) => <span key={key} className="border border-border px-2 py-1 text-[10px]">{key}: {formatNumber(Number(count), locale)}</span>)}</div>
              {errors.length > 0 && <ul className="mt-3 space-y-2">{errors.map((error, index) => <li key={`${job.id}-${index}`} className="border-s-2 border-[var(--brass)] ps-2 text-xs">
                <span>{String(error.message ?? error.error ?? "Ingestion failed")}</span>
                {typeof error.securityId === "string" && canEdit && <button type="button" className={`${buttonClass} ms-2`} disabled={pending} onClick={() => run({ operation: "ingest", securityId: error.securityId as string }, "Retry queued.")}>{text(locale, "Retry")}</button>}
              </li>)}</ul>}</td>
            <td className="px-3 py-3">{canEdit && <button type="button" className={buttonClass} disabled={pending} onClick={() => run({ operation: "resumeJob", data: { id: job.id } }, "Resume requested.")}><RefreshCw size={13} aria-hidden="true" />{text(locale, "Resume")}</button>}</td>
          </tr>;
        })}</tbody></table></div>}
      </Panel>
    </main>;
  }

  return <main className="mx-auto max-w-[1280px] space-y-6">
    <Heading locale={locale} role={role} title="Securities and data" intro="Inspect sourced financial records across the curated universe." />
    {feedback && <Status locale={locale}>{feedback}</Status>}
    <Panel locale={locale} title="Security universe" aside={<span className="font-mono text-xs text-muted-foreground">{formatNumber(data.securities.length, locale)} / {text(locale, "records")}</span>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <div>
          {data.securities.length === 0 ? <Empty>{text(locale, "No securities in the curated universe.")}</Empty> : <div className="max-h-[26rem] overflow-y-auto border border-border">
            {data.securities.map((security) => {
              const firm = data.companies.find((item) => item.id === security.company_id);
              const period = data.periods.find((item) => item.company_id === security.company_id && item.is_latest);
               const rowFacts = data.facts.filter((fact) => fact.company_id === security.company_id && fact.period_id === period?.id && fact.is_current &&
                 (((fact as typeof fact & { security_id?: string | null }).security_id ?? null) === null || (fact as typeof fact & { security_id?: string | null }).security_id === security.id));
              const unknowns = rowFacts.filter((fact) => fact.input_state === "unknown").length;
              const estimated = rowFacts.filter((fact) => fact.input_state === "estimated").length;
              const hasSecChanges = rowFacts.some((fact) => fact.sec_changed);
              const active = security.id === selectedId;
              return <button type="button" key={security.id} aria-current={active ? "true" : undefined} onClick={() => { setSelectedId(security.id); setTab("facts"); setFeedback(""); }}
                className={`block w-full border-b border-border px-4 py-3 text-start transition-colors ${active ? "border-s-[2px] border-s-[var(--brass)] bg-secondary" : "hover:bg-secondary/60"}`}>
                <span className="flex items-center justify-between gap-3"><b className="font-mono text-sm" dir="ltr">{security.ticker}</b><span className="text-xs text-muted-foreground">{security.exchange_code ?? security.exchange_id ?? "—"}</span></span>
                <span className="mt-1 block truncate text-sm">{firm?.name_ar || firm?.name || "—"}</span>
                <span className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span>{period?.fiscal_period_label ?? "—"} · {text(locale, "Unknown")}: {ltr(formatNumber(unknowns, locale))} · {text(locale, "Estimated")}: {ltr(formatNumber(estimated, locale))}{hasSecChanges && <span className="ms-2 border border-[var(--brass)] px-1.5 py-0.5 text-[var(--brass)]">{text(locale, "SEC changed")}</span>}</span>
                  <span>{formatDate(security.last_ingest_at, locale, { dateStyle: "medium" })}</span>
                </span>
                {security.last_ingest_error && <span className="mt-2 block border-s-2 border-[var(--brass)] ps-2 text-xs text-muted-foreground">{text(locale, security.last_ingest_error)}</span>}
              </button>;
            })}
          </div>}
        </div>
        <form className="h-fit border border-border p-4" onSubmit={(event) => submit(event, (form) => {
          const ticker = String(form.get("ticker") ?? "").trim().toUpperCase();
          if (!ticker) return;
          setLookupError(""); setLookup(undefined); setLookupTicker(ticker);
          startTransition(async () => {
            const result = await financialAction({ operation: "lookup", data: { ticker } });
            if (!result.ok) setLookupError(result.error);
            else setLookup(result.lookup);
          });
        })}>
          <h3 className="flex items-center gap-2 text-sm font-medium"><Search size={15} aria-hidden="true" />{text(locale, "Add a security")}</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{text(locale, "Look up a US ticker before adding it to the curated universe.")}</p>
          <div className="mt-4 flex gap-2"><input className={inputClass} name="ticker" value={lookupTicker} onChange={(event) => setLookupTicker(event.target.value.toUpperCase())} aria-label={text(locale, "Ticker")} placeholder="AAPL" required dir="ltr" />
            <button className={buttonClass} type="submit" disabled={pending || !canEdit}><Search size={14} aria-hidden="true" />{text(locale, "Preview")}</button></div>
          {lookupError && <p role="alert" className="mt-3 text-sm text-destructive">{text(locale, lookupError)}</p>}
          {lookup && <div className="mt-4 border-t border-border pt-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><Meta locale={locale} label="CIK" value={lookup.cik} /><Meta locale={locale} label="Name" value={lookup.name} /><Meta locale={locale} label="Exchange" value={lookup.exchange} /><Meta locale={locale} label="Sector" value={lookup.sector} /><Meta locale={locale} label="Fiscal year end" value={lookup.fiscalYearEnd} /></dl>
            <button type="button" className={`${buttonClass} mt-4 w-full`} disabled={pending || !canEdit} onClick={() => run({ operation: "add", data: { ticker: lookup.ticker } }, "Security added and ingestion started.", (result) => { if (result.id) setSelectedId(result.id); setLookup(undefined); })}><Plus size={14} aria-hidden="true" />{text(locale, "Confirm and ingest")}</button>
          </div>}
          {!canEdit && <p className="mt-3 text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
        </form>
      </div>
    </Panel>

    {screening && <ScreeningControls data={screening} role={role} securityId={selected?.id} securityLabel={selected ? `${selected.ticker} · ${company?.name_ar || company?.name || ""}` : undefined} />}
    {selected && company && <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div><p className="text-xs text-[var(--byline)]">{text(locale, "Security record")}</p><h2 className="mt-1 text-2xl font-semibold">{company.name_ar || company.name} <bdi dir="ltr" className="font-mono text-base text-muted-foreground">({selected.ticker})</bdi></h2>
          <p className="mt-1 text-xs text-muted-foreground">{selected.slug} · {latestPeriod?.fiscal_period_label ?? text(locale, "No latest period")} · {formatDate(latestPeriod?.period_end, locale)}</p></div>
        <span className="border border-border px-3 py-2 text-xs">{selected.in_universe ? text(locale, "In universe") : text(locale, "Outside universe")}</span>
      </div>
      <nav aria-label={text(locale, "Security details")} className="flex gap-1 overflow-x-auto border-b border-border">
        {(["facts", "segments", "prices", "coverage", "company"] as Tab[]).map((id) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setFactEditor(null); setSegmentEditor(null); }}
          className={`min-h-10 shrink-0 border-b-2 px-4 text-xs ${tab === id ? "border-[var(--brass)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{text(locale, id === "facts" ? "Facts" : id === "segments" ? "Segments" : id === "prices" ? "Prices" : id === "coverage" ? "Coverage" : "Company")}</button>)}
      </nav>
       {tab === "facts" && <FactsPanel locale={locale} facts={facts} period={latestPeriod ?? null} sources={data.sources} canEdit={canEdit} pending={pending} editor={factEditor} setEditor={setFactEditor} selectedId={selected.id} run={run} />}
      {tab === "segments" && <SegmentsPanel locale={locale} segments={segments} sources={data.sources} canEdit={canEdit} pending={pending} editor={segmentEditor} setEditor={setSegmentEditor} selectedId={selected.id} run={run} />}
       {tab === "prices" && <PricesPanel locale={locale} prices={data.prices.filter((item) => item.security_id === selected.id)} facts={facts} guidanceAsOf={(data as FinancialAdminData & { guidanceAsOf?: string }).guidanceAsOf} canEdit={canEdit} pending={pending} selectedId={selected.id} run={run} />}
      {tab === "coverage" && <Panel locale={locale} title="Analyst coverage"><Coverage locale={locale} security={selected} analysts={data.analysts} canEdit={canEdit} pending={pending} run={run} /></Panel>}
      {tab === "company" && <div className="space-y-4"><Panel locale={locale} title="Company profile"><form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => submit(event, companyUpdate)}>
        <Field label={text(locale, "Arabic name")}><input className={inputClass} name="name_ar" defaultValue={company.name_ar ?? ""} readOnly={!canEdit} /></Field>
        <Field label={text(locale, "English name")}><input className={inputClass} value={company.name} readOnly /></Field>
        <Field label={text(locale, "Arabic description")}><textarea className={`${inputClass} min-h-28`} name="description_ar" defaultValue={company.description_ar ?? ""} readOnly={!canEdit} /></Field>
        <Field label={text(locale, "English description")}><textarea className={`${inputClass} min-h-28`} name="description_en" defaultValue={company.description_en ?? ""} readOnly={!canEdit} /></Field>
        {canEdit && <div className="md:col-span-2"><button className={buttonClass} type="submit" disabled={pending}>{text(locale, "Save company fields")}</button></div>}
        {!canEdit && <p className="text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
      </form></Panel>
      <Panel locale={locale} title="Universe membership" aside={<button type="button" disabled={!canEdit || pending || !selected.in_universe} className={`${buttonClass} border-destructive/50`} onClick={() => setRemoving(true)}><Trash2 size={14} aria-hidden="true" />{text(locale, "Remove from universe")}</button>}>
        <p className="text-sm leading-6 text-muted-foreground">{text(locale, "Removing a security keeps its historical records and removes it from the curated universe.")}</p>
        {removing && <div role="group" aria-labelledby="remove-title" className="mt-4 border border-destructive/50 p-4">
          <h3 id="remove-title" className="font-medium">{text(locale, "Confirm removal")}</h3><p className="mt-2 text-sm text-muted-foreground">{text(locale, "This security will no longer be part of the curated universe.")}</p>
          <div className="mt-4 flex gap-2"><button type="button" className={buttonClass} onClick={() => setRemoving(false)}>{text(locale, "Cancel")}</button><button type="button" className={`${buttonClass} border-destructive/50`} disabled={pending} onClick={() => run({ operation: "remove", securityId: selected.id, data: { confirm: true } }, "Security removed from universe.", () => setRemoving(false))}>{text(locale, "Confirm removal")}</button></div>
        </div>}
      </Panel></div>}
    </section>}
    {!selected && data.securities.length > 0 && <Empty>{text(locale, "Select a security to inspect its records.")}</Empty>}
  </main>;
}

function Heading({ locale, role, title, intro }: { locale: Locale; role: string; title: string; intro: string }) {
  return <header className="border border-border bg-card">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
      <div><p className="font-mono text-[10px] tracking-[0.2em] text-[var(--byline)]">SUHAIL / FINANCIAL DATA</p><h1 className="mt-2 text-3xl font-semibold">{text(locale, title)}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text(locale, intro)}</p></div>
      <span className="inline-flex min-h-9 items-center gap-2 border border-border px-3 text-xs text-muted-foreground">{role === "admin" ? <ShieldCheck size={14} aria-hidden="true" /> : <LockKeyhole size={14} aria-hidden="true" />}{text(locale, role)}</span>
    </div>
  </header>;
}
function Status({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <p role="status" lang={locale} className="border-s-2 border-[var(--brass)] bg-card px-4 py-3 text-sm"><LocalizedText>{children}</LocalizedText></p>;
}
function Meta({ locale, label, value }: { locale: Locale; label: string; value: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{text(locale, label)}</dt><dd className="mt-1 break-words text-sm">{label === "CIK" ? ltr(value || "—") : value || "—"}</dd></div>;
}
type Run = (command: FinancialCommand, success: string, onSuccess?: (result: Extract<FinancialResult, { ok: true }>) => void) => void;

function FactsPanel({ locale, facts, period, sources, canEdit, pending, editor, setEditor, selectedId, run }: {
  locale: Locale; facts: FinancialAdminData["facts"]; period: FinancialAdminData["periods"][number] | null; sources: FinancialAdminData["sources"]; canEdit: boolean; pending: boolean;
  editor: { id: string; mode: "override" | "confirm" } | null; setEditor: (value: { id: string; mode: "override" | "confirm" } | null) => void; selectedId: string; run: Run;
}) {
  const periodDate = period?.period_end ?? null;
  const [addingProhibitedIncome, setAddingProhibitedIncome] = useState(false);
  const getSource = (id: string | null) => sources.find((source) => source.id === id);
  const hasProhibitedIncome = facts.some((fact) => fact.line_item === "prohibited_income" && fact.is_current);
  return <Panel locale={locale} title="Current facts">
    {canEdit && period?.period_type === "annual" && !hasProhibitedIncome && <div className="mb-4">
      <button type="button" className={buttonClass} onClick={() => setAddingProhibitedIncome((value) => !value)}><Plus size={14} aria-hidden="true" />{text(locale, "Add prohibited income")}</button>
      {addingProhibitedIncome && <ProhibitedIncomeForm locale={locale} period={period} selectedId={selectedId} pending={pending} run={run} close={() => setAddingProhibitedIncome(false)} />}
    </div>}
    {facts.filter((fact) => fact.is_current).length === 0 ? <Empty>{text(locale, "No facts are recorded for this period.")}</Empty> : <div className="space-y-3">{facts.filter((fact) => fact.is_current).map((fact) => {
      const source = getSource(fact.source_id);
      const extensions = fact as typeof fact & { origin?: string; protected_current?: boolean; calculation_version?: string };
      const alternatives = facts.filter((candidate) => candidate.line_item === fact.line_item && !candidate.is_current && (candidate as typeof candidate & { origin?: string }).origin === "sec");
      const secChanged = Boolean(fact.sec_changed);
      const canConfirm = fact.line_item === "interest_bearing_investments" && fact.input_state === "estimated";
      return <article key={fact.id} className="border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{fact.label || displayLabel("lineItem", fact.line_item, locale)}</h3>
            <span className={`border px-2 py-1 text-xs ${secChanged ? "border-[var(--brass)] text-[var(--brass)]" : "border-border text-muted-foreground"}`}>{secChanged ? text(locale, "SEC changed") : displayLabel("inputState", fact.input_state, locale)}</span>
          </div><p className="mt-2 text-xs text-muted-foreground">{text(locale, "State")}: {displayLabel("inputState", fact.input_state, locale)} · {text(locale, "Tier")}: {displayLabel("tier", fact.confidence_tier, locale)} · {text(locale, "Source")}: {source?.label ?? "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{text(locale, "Date")}: {formatDate(fact.as_of_date ?? periodDate, locale)} · {text(locale, "Origin")}: {extensions.origin ?? "—"} · {text(locale, "Protected current")}: {extensions.protected_current ? text(locale, "Yes") : text(locale, "No")}{fact.mapping_note && <> · {text(locale, "Mapping note")}: {fact.mapping_note}</>}</p>
            {fact.unknown_note && <p className="mt-1 text-xs text-muted-foreground">{text(locale, "Note")}: {fact.unknown_note}</p>}
            {source?.notes && <p className="mt-1 text-xs text-muted-foreground">{text(locale, "Source notes")}: {source.notes}</p>}
            {extensions.calculation_version && <p className="mt-1 font-mono text-[10px] text-muted-foreground" dir="ltr">calc {extensions.calculation_version}</p>}
            {source?.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4">{text(locale, "Open source")}<ArrowUpRight size={12} aria-hidden="true" /></a>}
          </div>
          <strong className="font-mono text-lg tabular-nums" dir="ltr">{fact.value === null ? "—" : formatNumber(Number(fact.value), locale, { maximumFractionDigits: 4 })}{fact.currency ? ` ${fact.currency}` : ""}</strong>
        </div>
        {alternatives.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-xs font-medium">{text(locale, "Retained SEC alternatives")}</p>{alternatives.map((alt) => <div key={alt.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span dir="ltr" className="font-mono">{String(alt.value ?? "—")} · {alt.mapping_note ?? alt.line_item} · {getSource(alt.source_id)?.label ?? "—"}</span>
          {canEdit && <button type="button" className={buttonClass} disabled={pending} onClick={() => run({ operation: "accept", securityId: selectedId, data: { factId: alt.id } }, "SEC alternative accepted.")}>{text(locale, "Accept SEC")}</button>}
        </div>)}</div>}
         {canEdit && fact.line_item !== "market_value_basis" && <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => setEditor(editor?.id === fact.id ? null : { id: fact.id, mode: "override" })}>{text(locale, "Override")}</button>
          {canConfirm && <button type="button" className={buttonClass} onClick={() => setEditor(editor?.id === fact.id ? null : { id: fact.id, mode: "confirm" })}><FileCheck2 size={13} aria-hidden="true" />{text(locale, "Confirm from filing")}</button>}</div>}
        {editor?.id === fact.id && <FactForm key={`${fact.id}-${editor.mode}`} locale={locale} fact={fact} period={period} mode={editor.mode} pending={pending} selectedId={selectedId} run={run} close={() => setEditor(null)} />}
      </article>;
    })}</div>}
    {!canEdit && <p className="mt-4 text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
  </Panel>;
}

function ProhibitedIncomeForm({ locale, period, selectedId, pending, run, close }: {
  locale: Locale; period: FinancialAdminData["periods"][number]; selectedId: string; pending: boolean; run: Run; close: () => void;
}) {
  const [sourceType, setSourceType] = useState("regulatory_filing");
  const [inputState, setInputState] = useState<"reported" | "estimated">("reported");
  return <form className="mt-4 grid gap-3 border border-border p-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run({ operation: "addProhibitedIncome" as FinancialCommand["operation"], securityId: selectedId, data: {
      periodId: period.id,
      value: String(form.get("value") ?? ""),
      input_state: inputState,
      confidence_tier: inputState === "reported" ? "Verified" : "Estimated",
      reason: String(form.get("reason") ?? ""),
      source: {
        label: String(form.get("label") ?? ""),
        source_type: sourceType,
        source_url: String(form.get("source_url") ?? "") || undefined,
        document_reference: String(form.get("document_reference") ?? "") || undefined,
      },
      period_start: period.period_start,
      period_end: period.period_end,
    } }, "Saved.", close);
  }}>
    <h3 className="md:col-span-2 text-sm font-medium">{text(locale, "Add prohibited income")}</h3>
    <p className="md:col-span-2 text-xs leading-6 text-muted-foreground">{text(locale, "Gross annual prohibited income includes interest income, prohibited-activity revenue and other analyst-identified prohibited income for the displayed annual period. Use a sourced total or a conservative estimate.")} <bdi dir="ltr" className="font-mono">{period.period_start} — {period.period_end}</bdi></p>
    <Field label={text(locale, "Value")}><input className={inputClass} name="value" inputMode="decimal" required /></Field>
    <Field label={text(locale, "Input state")}><select className={inputClass} value={inputState} onChange={(event) => setInputState(event.target.value as "reported" | "estimated")}><option value="reported">{displayLabel("inputState", "reported", locale)}</option><option value="estimated">{displayLabel("inputState", "estimated", locale)}</option></select></Field>
    <p className="text-xs text-muted-foreground md:col-span-2">{text(locale, "Confidence tier")}: {displayLabel("tier", inputState === "reported" ? "Verified" : "Estimated", locale)}</p>
    <Field label={text(locale, "Source type")}><select className={inputClass} name="source_type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="internal">{displayLabel("sourceType", "internal", locale)}</option><option value="regulatory_filing">{displayLabel("sourceType", "regulatory_filing", locale)}</option></select></Field>
    <Field label={text(locale, "Source label")}><input className={inputClass} name="label" required /></Field>
    <Field label={text(locale, "Filing note reference")}><input className={inputClass} name="document_reference" required={sourceType === "regulatory_filing"} /></Field>
    <Field label={text(locale, "Source URL")}><input className={inputClass} name="source_url" type="url" required={sourceType === "regulatory_filing"} /></Field>
    <Field label={text(locale, "Reason (required)")}><textarea className={`${inputClass} min-h-20`} name="reason" required /></Field>
    <div className="flex gap-2 md:col-span-2"><button type="submit" className={buttonClass} disabled={pending}>{text(locale, "Save")}</button><button type="button" className={buttonClass} onClick={close}>{text(locale, "Cancel")}</button></div>
  </form>;
}

function FactForm({ locale, fact, period, mode, pending, selectedId, run, close }: { locale: Locale; fact: FinancialAdminData["facts"][number]; period: FinancialAdminData["periods"][number] | null; mode: "override" | "confirm"; pending: boolean; selectedId: string; run: Run; close: () => void }) {
  const [sourceType, setSourceType] = useState(mode === "confirm" ? "regulatory_filing" : "internal");
  const [prohibitedState, setProhibitedState] = useState<"reported" | "estimated" | "unknown">(fact.input_state === "estimated" || fact.input_state === "unknown" ? fact.input_state : "reported");
  return <form className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const sourceType = String(form.get("source_type"));
    const data = {
      factId: fact.id,
      ...(fact.line_item === "prohibited_income" ? { period_start: period?.period_start, period_end: period?.period_end } : {}),
      ...(mode === "override" ? {
        value: fact.line_item === "prohibited_income" && prohibitedState === "unknown" ? null : String(form.get("value") ?? "") || null,
        input_state: fact.line_item === "prohibited_income" ? prohibitedState : String(form.get("input_state")),
        confidence_tier: fact.line_item === "prohibited_income" ? (prohibitedState === "reported" ? "Verified" : "Estimated") : String(form.get("confidence_tier")),
      } : {}),
      reason: String(form.get("reason") ?? ""),
      source: { label: String(form.get("label") ?? ""), source_type: mode === "confirm" ? "regulatory_filing" : sourceType, source_url: String(form.get("source_url") ?? "") || undefined, document_reference: String(form.get("document_reference") ?? "") || undefined },
    };
    run({ operation: mode, securityId: selectedId, data }, mode === "confirm" ? "Filing confirmation saved." : "Override saved.", close);
  }}>
    <h4 className="md:col-span-2 text-sm font-medium">{text(locale, mode === "override" ? "New fact override" : "Filing confirmation")}</h4>
    {mode === "override" && <><Field label={text(locale, "Value")}><input className={inputClass} name="value" defaultValue={fact.value ?? ""} inputMode="decimal" disabled={fact.line_item === "prohibited_income" && prohibitedState === "unknown"} /></Field>
      <Field label={text(locale, "Input state")}>{fact.line_item === "prohibited_income" ? <select className={inputClass} value={prohibitedState} onChange={(event) => setProhibitedState(event.target.value as "reported" | "estimated" | "unknown")}><option value="reported">{displayLabel("inputState", "reported", locale)}</option><option value="estimated">{displayLabel("inputState", "estimated", locale)}</option><option value="unknown">{displayLabel("inputState", "unknown", locale)}</option></select> : <select className={inputClass} name="input_state" defaultValue={fact.input_state}>{states.map((state) => <option key={state} value={state}>{displayLabel("inputState", state, locale)}</option>)}</select>}</Field>
      <Field label={text(locale, "Confidence tier")}>{fact.line_item === "prohibited_income" ? <span className="flex min-h-10 items-center border border-border px-3 text-sm">{prohibitedState === "unknown" ? displayLabel("inputState", "unknown", locale) : displayLabel("tier", prohibitedState === "reported" ? "Verified" : "Estimated", locale)}</span> : <select className={inputClass} name="confidence_tier" defaultValue={fact.confidence_tier}>{tiers.map((tier) => <option key={tier} value={tier}>{displayLabel("tier", tier, locale)}</option>)}</select>}</Field>
      <Field label={text(locale, "Source type")}><select className={inputClass} name="source_type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="internal">{displayLabel("sourceType", "internal", locale)}</option><option value="regulatory_filing">{displayLabel("sourceType", "regulatory_filing", locale)}</option></select></Field></>}
    <Field label={text(locale, "Source label")}><input className={inputClass} name="label" required /></Field>
    <Field label={text(locale, "Filing note reference")}><input className={inputClass} name="document_reference" required={mode === "confirm" || sourceType === "regulatory_filing"} /></Field>
    <Field label={text(locale, "Source URL")}><input className={inputClass} name="source_url" type="url" required={mode === "confirm" || sourceType === "regulatory_filing"} /></Field>
    <Field label={text(locale, "Reason (required)")}><textarea className={`${inputClass} min-h-20`} name="reason" required /></Field>
    <div className="flex gap-2 md:col-span-2"><button type="submit" className={buttonClass} disabled={pending}>{text(locale, "Save")}</button><button type="button" className={buttonClass} onClick={close}>{text(locale, "Cancel")}</button></div>
  </form>;
}

function SegmentsPanel({ locale, segments, sources, canEdit, pending, editor, setEditor, selectedId, run }: {
  locale: Locale; segments: FinancialAdminData["segments"]; sources: FinancialAdminData["sources"]; canEdit: boolean; pending: boolean; editor: string | "new" | null;
  setEditor: (value: string | "new" | null) => void; selectedId: string; run: Run;
}) {
  const unclassified = segments.some((segment) => segment.activity_category === "unclassified");
  return <Panel locale={locale} title="Business segments" aside={canEdit && <button type="button" className={buttonClass} onClick={() => setEditor(editor === "new" ? null : "new")}><Plus size={14} aria-hidden="true" />{text(locale, "Add segment")}</button>}>
    {unclassified && <p className="mb-4 flex items-start gap-2 border-s-2 border-[var(--brass)] bg-secondary px-4 py-3 text-sm"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{text(locale, "One or more segments are unclassified; classify them using filing evidence.")}</p>}
    {segments.length === 0 ? <Empty>{text(locale, "No business segments are recorded for the latest period.")}</Empty> : <div className="divide-y divide-border border-y border-border">{segments.map((segment) => {
      const source = sources.find((item) => item.id === segment.source_id);
      return <article key={segment.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-medium">{segment.segment_name}</h3><p className="mt-1 text-xs text-muted-foreground">{displayLabel("activity", segment.activity_category, locale)} · {text(locale, "State")}: {displayLabel("inputState", segment.input_state, locale)} · {text(locale, "Tier")}: {displayLabel("tier", segment.confidence_tier, locale)}</p>
          {segment.description && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{segment.description}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{text(locale, "Category basis")}: {segment.category_basis || "—"} · {text(locale, "Source")}: {source?.label ?? "—"} · {text(locale, "Source notes")}: {source?.notes ?? "—"}</p>
        </div><bdi dir="ltr" className="font-mono text-sm">{segment.revenue_amount === null ? "—" : formatNumber(Number(segment.revenue_amount), locale)} · {segment.revenue_share === null ? "—" : formatNumber(Number(segment.revenue_share) * 100, locale, { maximumFractionDigits: 2 }) + "%"}</bdi>
      </div>
      {canEdit && <div className="mt-3 flex gap-2"><button type="button" className={buttonClass} onClick={() => setEditor(editor === segment.id ? null : segment.id)}>{text(locale, "Edit")}</button><button type="button" className={buttonClass} disabled={pending} onClick={() => { if (window.confirm(text(locale, "Delete this segment?"))) run({ operation: "deleteSegment", securityId: selectedId, data: { id: segment.id } }, "Segment deleted."); }}><Trash2 size={13} aria-hidden="true" />{text(locale, "Delete")}</button></div>}
      {editor === segment.id && <SegmentForm locale={locale} segment={segment} sources={sources} selectedId={selectedId} pending={pending} run={run} close={() => setEditor(null)} />}
      </article>;
    })}</div>}
    {editor === "new" && <SegmentForm locale={locale} sources={sources} selectedId={selectedId} pending={pending} run={run} close={() => setEditor(null)} />}
    {!canEdit && <p className="mt-4 text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
  </Panel>;
}
function SegmentForm({ locale, segment, sources, selectedId, pending, run, close }: { locale: Locale; segment?: FinancialAdminData["segments"][number]; sources: FinancialAdminData["sources"]; selectedId: string; pending: boolean; run: Run; close: () => void }) {
  const linkedSource = sources.find((source) => source.id === segment?.source_id);
  const [category, setCategory] = useState<string>(segment?.activity_category ?? "unclassified");
  const [sourceType, setSourceType] = useState(linkedSource?.source_type === "internal" ? "internal" : "regulatory_filing");
  return <form className="mt-4 grid gap-3 border border-border p-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const sourceType = String(form.get("source_type"));
    run({ operation: "segment", securityId: selectedId, data: {
      ...(segment ? { id: segment.id } : {}), segment_name: String(form.get("segment_name")), description: String(form.get("description") ?? "") || undefined,
      revenue_amount: String(form.get("revenue_amount") ?? "") || null, activity_category: String(form.get("activity_category")),
      category_basis: String(form.get("category_basis") ?? "") || undefined, input_state: String(form.get("input_state")), confidence_tier: String(form.get("confidence_tier")),
      source: { label: String(form.get("label") ?? ""), source_type: sourceType, source_url: String(form.get("source_url") ?? "") || undefined, document_reference: String(form.get("document_reference") ?? "") || undefined },
    } }, "Segment saved.", close);
  }}>
    <h3 className="md:col-span-2 font-medium">{text(locale, segment ? "Edit segment" : "New segment")}</h3>
    <Field label={text(locale, "Segment name")}><input className={inputClass} name="segment_name" defaultValue={segment?.segment_name ?? ""} required /></Field>
    <Field label={text(locale, "Revenue amount")}><input className={inputClass} name="revenue_amount" inputMode="decimal" defaultValue={segment?.revenue_amount ?? ""} /></Field>
    <Field label={text(locale, "Description")}><textarea className={`${inputClass} min-h-20`} name="description" defaultValue={segment?.description ?? ""} /></Field>
    <Field label={text(locale, "Activity category")}><select className={inputClass} name="activity_category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{displayLabel("activity", item, locale)}</option>)}</select></Field>
    <Field label={text(locale, "Category basis")}><textarea className={`${inputClass} min-h-20`} name="category_basis" required={category !== "unclassified"} defaultValue={segment?.category_basis ?? ""} /></Field>
    <Field label={text(locale, "Input state")}><select className={inputClass} name="input_state" defaultValue={segment?.input_state ?? "reported"}>{states.map((state) => <option key={state} value={state}>{displayLabel("inputState", state, locale)}</option>)}</select></Field>
    <Field label={text(locale, "Confidence tier")}><select className={inputClass} name="confidence_tier" defaultValue={segment?.confidence_tier ?? "Verified"}>{tiers.map((tier) => <option key={tier} value={tier}>{displayLabel("tier", tier, locale)}</option>)}</select></Field>
    <Field label={text(locale, "Source type")}><select className={inputClass} name="source_type" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="regulatory_filing">{displayLabel("sourceType", "regulatory_filing", locale)}</option><option value="internal">{displayLabel("sourceType", "internal", locale)}</option></select></Field>
    <Field label={text(locale, "Source label")}><input className={inputClass} name="label" defaultValue={linkedSource?.label ?? ""} required /></Field>
    <Field label={text(locale, "Filing note reference")}><input className={inputClass} name="document_reference" defaultValue={linkedSource?.document_reference ?? ""} required={sourceType === "regulatory_filing"} /></Field>
    <Field label={text(locale, "Source URL")}><input className={inputClass} name="source_url" type="url" defaultValue={linkedSource?.source_url ?? ""} required={sourceType === "regulatory_filing"} /></Field>
    <div className="flex gap-2 md:col-span-2"><button type="submit" disabled={pending} className={buttonClass}>{text(locale, "Save segment")}</button><button type="button" onClick={close} className={buttonClass}>{text(locale, "Cancel")}</button></div>
  </form>;
}

function PricesPanel({ locale, prices, facts, guidanceAsOf, canEdit, pending, selectedId, run }: {
  locale: Locale; prices: FinancialAdminData["prices"]; facts: FinancialAdminData["facts"]; guidanceAsOf?: string; canEdit: boolean; pending: boolean; selectedId: string; run: Run;
}) {
  const [monthEndError, setMonthEndError] = useState("");
  const quarter = guidanceAsOf ? completedQuarter(guidanceAsOf) : null;
  const orderedPrices = [...prices].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const attestedPriceFor = (monthEnd: string) => selectMonthEnd(prices, monthEnd);
  const shares = facts.find((fact) => fact.line_item === "shares_outstanding" && fact.is_current);
  const equity = facts.find((fact) => fact.line_item === "total_equity" && fact.is_current);
  const sharesValue = shares && shares.value !== null && shares.input_state !== "unknown" ? Number(shares.value) : null;
  const equityValue = equity && equity.value !== null && equity.input_state !== "unknown" ? Number(equity.value) : null;
  const quarterObservations = quarter?.monthEnds.map((monthEnd) => ({ monthEnd, price: attestedPriceFor(monthEnd) })) ?? [];
  const guidanceValue = guidanceAsOf ? deriveMarketValue(guidanceAsOf, prices, shares, equity).value : null;
  return <Panel locale={locale} title="Manual price history">
    <section className="mb-5 border border-border bg-secondary/40 p-4" aria-label={text(locale, "Market value guidance")}>
      <h3 className="text-sm font-medium">{text(locale, "Market value guidance")}</h3>
      {quarter ? <>
        <p className="mt-1 text-xs text-muted-foreground">{text(locale, "Latest completed quarter")}: <bdi dir="ltr" className="font-mono">{quarter.label}</bdi></p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {quarterObservations.map(({ monthEnd, price }) => <div key={monthEnd} className="border border-border bg-card px-3 py-2 text-xs">
            <p className="text-muted-foreground">{text(locale, "Required month-end observation")}: <bdi dir="ltr" className="font-mono">{monthEnd}</bdi></p>
            <p className="mt-1">{price ? <>{text(locale, "Attested close")}: {ltr(price.close === null ? "—" : formatNumber(Number(price.close), locale))} · {formatDate(price.date, locale)}</> : text(locale, "Missing attested observation")}</p>
          </div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{text(locale, "Mean of the three attested closes multiplied by latest shares outstanding, compared with mapped equity; use the higher amount. Nonpositive equity uses the average.")}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
          <span>{text(locale, "Shares outstanding")}: {sharesValue === null ? text(locale, "Unknown") : ltr(formatNumber(sharesValue, locale))}</span>
          <span>{text(locale, "Mapped equity")}: {equityValue === null ? text(locale, "Unknown") : ltr(formatNumber(equityValue, locale))}</span>
          {guidanceValue === null
            ? <span role="note" className="basis-full border-s-2 border-[var(--brass)] ps-2">{text(locale, "Guidance unavailable: all three sourced attested closes, latest shares outstanding and mapped equity are required.")}</span>
            : <strong className="basis-full font-mono tabular-nums" dir="ltr">{text(locale, "Calculated amount")}: {formatNumber(guidanceValue, locale)}</strong>}
        </div>
      </> : <p role="note" className="mt-2 text-xs leading-5 text-muted-foreground">{text(locale, "Quarter guidance date is unavailable.")}</p>}
    </section>
    {canEdit && <form className="mb-5 grid gap-3 border-b border-border pb-5 md:grid-cols-3" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const closeDate = String(form.get("date") ?? "");
      const monthEndFor = String(form.get("month_end_for") ?? "");
      if (monthEndFor) {
        const monthEnd = new Date(`${monthEndFor}T00:00:00Z`);
        const calendarMonthEnd = new Date(Date.UTC(monthEnd.getUTCFullYear(), monthEnd.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
        if (monthEndFor !== calendarMonthEnd || closeDate.slice(0, 7) !== monthEndFor.slice(0, 7) || closeDate > monthEndFor) {
          setMonthEndError(text(locale, "Month-end representation must be the calendar month-end in the same month as the close date."));
          return;
        }
      }
      setMonthEndError("");
      run({ operation: "price", securityId: selectedId, data: { date: String(form.get("date")), close: String(form.get("close")), currency: String(form.get("currency")), source_label: String(form.get("source_label")), source_url: String(form.get("source_url") ?? "") || undefined, ...(monthEndFor ? { month_end_for: monthEndFor } : {}) } }, "Manual close saved.");
    }}>
      <Field label={text(locale, "Date")}><input className={inputClass} name="date" type="date" required /></Field>
      <Field label={text(locale, "Month-end represented")}><input className={inputClass} name="month_end_for" type="date" aria-describedby="month-end-source-confirmation" /></Field>
      <Field label={text(locale, "Close")}><input className={inputClass} name="close" type="number" step="any" min="0" required /></Field>
      <Field label={text(locale, "Currency")}><input className={inputClass} name="currency" defaultValue="USD" required /></Field>
      <Field label={text(locale, "Source label")}><input className={inputClass} name="source_label" required /></Field>
      <Field label={text(locale, "Source URL")}><input className={inputClass} name="source_url" type="url" /></Field>
      <p id="month-end-source-confirmation" className="text-xs leading-5 text-muted-foreground md:col-span-2">{text(locale, "Use only when the source explicitly identifies the calendar month-end represented by this close. The close date is its actual last trading day; do not infer an attribution.")}</p>
      {monthEndError && <p role="alert" className="text-xs text-destructive md:col-span-3">{monthEndError}</p>}
      <div className="flex items-end"><button className={buttonClass} type="submit" disabled={pending}>{text(locale, "Save close")}</button></div>
    </form>}
    {prices.length === 0 ? <Empty>{text(locale, "No manual prices are recorded.")}</Empty> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground">{["Date", "Month-end represented", "Close", "Currency", "Source", "Provenance"].map((item) => <th key={item} className="px-3 py-3 text-start font-medium">{text(locale, item)}</th>)}</tr></thead><tbody>{orderedPrices.map((price) => {
      const provenance = price as typeof price & { source_url?: string | null; source_id?: string | null };
       const monthEndFor = (price as typeof price & { month_end_for?: string | null }).month_end_for;
       return <tr key={price.id} className="border-b border-border"><td className="px-3 py-3">{formatDate(price.date, locale)}</td><td className="px-3 py-3 font-mono" dir="ltr">{monthEndFor ?? "—"}</td><td className="px-3 py-3 font-mono" dir="ltr">{price.close === null ? "—" : formatNumber(Number(price.close), locale)}</td><td className="px-3 py-3">{price.currency ?? "—"}</td><td className="px-3 py-3">{price.source_label ?? "—"}</td><td className="px-3 py-3">{provenance.source_url ? <a href={provenance.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{text(locale, "Open source")}<ArrowUpRight size={12} aria-hidden="true" /></a> : provenance.source_id ?? "—"}</td></tr>;
    })}</tbody></table></div>}
    {!canEdit && <p className="mt-4 text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
  </Panel>;
}

function Coverage({ locale, security, analysts, canEdit, pending, run }: { locale: Locale; security: FinancialAdminData["securities"][number]; analysts: FinancialAdminData["analysts"]; canEdit: boolean; pending: boolean; run: Run }) {
  return <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const analystId = String(form.get("analystId") ?? "") || null;
    run({ operation: "coverage", securityId: security.id, data: { analystId } }, "Coverage assignment saved.");
  }}>
    <Field label={text(locale, "Assigned analyst")}><select name="analystId" className={inputClass} defaultValue={security.coverage_analyst_id ?? ""} disabled={!canEdit}><option value="">{text(locale, "No analyst assigned")}</option>{analysts.map((analyst) => <option key={analyst.id} value={analyst.id}>{analyst.name_ar} {analyst.name_en ? ` / ${analyst.name_en}` : ""}{analyst.active ? "" : ` (${text(locale, "inactive")})`}</option>)}</select></Field>
    {canEdit ? <div className="flex items-end"><button className={buttonClass} type="submit" disabled={pending}>{text(locale, "Save coverage")}</button></div> : <p className="text-xs text-muted-foreground">{text(locale, "Editors have read-only access.")}</p>}
    {security.coverage_started_at && <p className="text-xs text-muted-foreground sm:col-span-2">{text(locale, "Coverage started")}: {formatDate(security.coverage_started_at, locale, { dateStyle: "medium", timeStyle: "short" })}</p>}
  </form>;
}
