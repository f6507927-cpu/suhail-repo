"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowUpRight, Check, CircleAlert, Play, ShieldCheck } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/format";
import { reviewText, type Locale } from "@/components/accounts/types";
import { LocalizedText } from "@/components/foundation/shared";
import { StatusBadge, type StatusCode } from "@/components/foundation/StatusBadge";
import type { ScreeningAdminData, RunDetail, Verification } from "@/screening/contracts";
import { runScreenAction, runUniverseAction, verifyScreenAction } from "@/app/[locale]/(private)/admin/(protected)/screening-actions";
import { renderArabicDraft } from "@/engine/reasons/ar";
import { renderEnglish } from "@/engine/reasons/en";
import type { StatusReason as EngineStatusReason } from "@/engine/types";
import { displayLabel } from "@/i18n/presentation";

const copy = [
  "Run screening now", "Screen all", "Ingest all", "Methodology version", "Choose a methodology version",
  "Screening runs", "No screening runs recorded.", "Generated", "Version", "Status", "Hash",
  "Unchanged", "Run details", "Editors have read-only access.", "Run started.", "Universe job started.",
  "Processed", "Failed", "Inserted", "Unchanged records", "Job", "Job summary", "Resume screen job",
  "Verify", "Verification passed.", "Verification failed.", "Stored hash", "Computed hash",
  "Hash matches", "Replay matches", "Differences", "Path", "Expected", "Actual", "Criteria",
  "Unknowns", "Reasons", "Hash payload", "Criterion", "Result", "Numerator", "Denominator",
  "Ratio", "Threshold", "Input states", "Calculation trace", "Reason", "Field or input",
  "Why missing", "Effect", "Severity", "Kind", "No criteria recorded.", "No unknowns recorded.",
  "No structured reasons recorded.", "No differences recorded.", "Security", "Financial period",
  "Data as of", "Confidence", "Data adequacy", "Engine version", "Calculation version",
  "The request failed. Reload and try again.", "No production methodology to screen with",
  "Yes", "No",
  "Securities and data",
  "SUHAIL / SCREENING", "SUHAIL / SCREENING RUN",
  "Unchanged result",
  "No reason template available.", "Criterion ID", "Reason code", "Field", "Threshold unit",
  "Borderline count", "Unknown count",
  "Hash verified.", "replay not supported for engine",
  "Running",
] as const;
function t(locale: Locale, value: string) {
  if (value === "running") return reviewText(locale, "Running");
  for (const phrase of copy) if (phrase === value) return reviewText(locale, phrase);
  return reviewText(locale, value);
}
const button = "inline-flex min-h-9 items-center justify-center gap-2 border border-border px-3 text-xs transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";
const input = "min-h-9 border border-border bg-background px-2 text-xs outline-none focus:border-[var(--brass)]";
const ltr = (value: unknown) => <bdi dir="ltr" className="font-mono tabular-nums">{value == null || value === "" ? "—" : String(value)}</bdi>;
const formattedNumber = (locale: Locale, value: unknown) => {
  const number = Number(value);
  return value == null || value === "" || !Number.isFinite(number) ? ltr(value) : <bdi dir="ltr" className="font-mono tabular-nums">{formatNumber(number, locale, { maximumFractionDigits: 6 })}</bdi>;
};
const reasonKinds = new Set(["failure", "borderline", "criterion_unknown", "blocking_unknown", "review_unknown", "counts"]);
const reasonCodes = new Set([
  "boolean_positive", "boolean_nonpositive", "within_margin", "max_within_limit", "max_exceeded",
  "min_met", "min_not_met", "denominator_unavailable", "denominator_nonpositive", "numerator_unavailable",
  "no_segments", "shares_unavailable", "unclassified_primary", "primary_tied", "primary_prohibited",
  "primary_permissible", "evaluator_unregistered", "stale_data", "criterion_counts",
]);
const thresholdUnits = new Set(["percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap", "boolean", "absolute"]);
type StoredStatusReason = RunDetail["run"]["status_reasons"][number];
function toEngineStatusReason(reason: StoredStatusReason): EngineStatusReason | null {
  if (!reasonKinds.has(reason.kind) || !reasonCodes.has(reason.reason_code)) return null;
  if (reason.threshold_unit != null && !thresholdUnits.has(reason.threshold_unit)) return null;
  return {
    kind: reason.kind as EngineStatusReason["kind"],
    criterionId: reason.criterion_id,
    label: reason.criterion_label ?? "",
    ratio: reason.ratio,
    threshold: reason.threshold,
    thresholdUnit: (reason.threshold_unit ?? null) as EngineStatusReason["thresholdUnit"],
    reasonCode: reason.reason_code as EngineStatusReason["reasonCode"],
    field: reason.field ?? null,
    ...(reason.borderline_count === undefined ? {} : { borderlineCount: reason.borderline_count }),
    ...(reason.unknown_count === undefined ? {} : { unknownCount: reason.unknown_count }),
  };
}
function renderReason(locale: Locale, stored: StoredStatusReason) {
  const reason = toEngineStatusReason(stored);
  if (!reason) return t(locale, "No reason template available.");
  return locale === "ar" ? renderArabicDraft(reason) : renderEnglish(reason);
}

type Props = {
  data: ScreeningAdminData;
  role: "admin" | "editor";
  securityId?: string;
  securityLabel?: string;
  ingestion?: boolean;
};

export function ScreeningControls({ data, role, securityId, securityLabel, ingestion = false }: Props) {
  const router = useRouter();
  const locale = (useLocale() === "en" ? "en" : "ar") as Locale;
  const canRun = role === "admin";
  const [versionId, setVersionId] = useState(data.versions[0]?.id ?? "");
  const [feedback, setFeedback] = useState("");
  const [bulkKind, setBulkKind] = useState<"ingest" | "screen">("screen");
  const [summary, setSummary] = useState<{ jobId?: string; processed: number; failed: number; inserted: number; unchanged: number; status: string } | null>(null);
  const [runLink, setRunLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const execute = (operation: () => Promise<{ ok: true; runId?: string; unchanged?: boolean; jobId?: string; summary?: { processed: number; failed: number; inserted: number; unchanged: number; status: string }; message?: string } | { ok: false; error: string }>, success: string, complete?: (result: { runId?: string; unchanged?: boolean }) => void) => {
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) { setFeedback(t(locale, result.error)); return; }
        setFeedback(result.message ? t(locale, result.message) : t(locale, success));
        if (result.summary) setSummary({ ...result.summary, jobId: result.jobId });
        complete?.(result);
      } catch {
        setFeedback(t(locale, "The request failed. Reload and try again."));
      }
    });
  };

  const runSelected = () => {
    if (!securityId || !versionId || !canRun) return;
    setRunLink(null);
    execute(() => runScreenAction({ securityId, methodologyVersionId: versionId }), "Run started.", (result) => {
      if (!result.runId) return;
      if (result.unchanged) {
        setFeedback(t(locale, "Unchanged result"));
        setRunLink(result.runId);
      } else router.push(`/admin/runs/${encodeURIComponent(result.runId)}`);
    });
  };
  const bulk = (kind: "ingest" | "screen", id?: string) => {
    setBulkKind(kind);
    execute(() => runUniverseAction(kind, id), "Universe job started.");
  };

  return <section className="space-y-4 border border-border bg-card p-4 sm:p-5" aria-labelledby={ingestion ? "screening-bulk-title" : "screening-title"}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--byline)]">{t(locale, "SUHAIL / SCREENING")}</p>
        <h2 id={ingestion ? "screening-bulk-title" : "screening-title"} className="mt-1 text-base font-semibold">{t(locale, ingestion ? "Screen all" : "Run screening now")}</h2>
        {!ingestion && securityLabel && <p className="mt-1 text-xs text-muted-foreground">{securityLabel}</p>}
      </div>
      {ingestion && canRun && <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={pending} onClick={() => bulk("ingest")}><Play size={13} aria-hidden="true" />{t(locale, "Ingest all")}</button>
        <button type="button" className={button} disabled={pending} onClick={() => bulk("screen")}><Play size={13} aria-hidden="true" />{t(locale, "Screen all")}</button>
      </div>}
    </div>

    {!ingestion && <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="grid flex-1 gap-1 text-xs text-muted-foreground">
        {t(locale, "Methodology version")}
        <select className={`${input} w-full`} value={versionId} onChange={(event) => setVersionId(event.target.value)} disabled={!canRun || data.versions.length === 0}>
          {data.versions.length === 0 && <option value="">{t(locale, "Choose a methodology version")}</option>}
          {data.versions.map((version) => <option key={version.id} value={version.id}>{version.methodologyName} · {version.label}</option>)}
        </select>
      </label>
      {canRun && <button type="button" className={button} disabled={pending || !securityId || !versionId} onClick={runSelected}><Play size={13} aria-hidden="true" />{t(locale, "Run screening now")}</button>}
    </div>}

    {!canRun && <p className="text-xs text-muted-foreground">{t(locale, "Editors have read-only access.")}</p>}
    {feedback && <p role="status" className="border-s-2 border-[var(--brass)] bg-secondary/40 px-3 py-2 text-xs"><LocalizedText>{feedback}</LocalizedText></p>}
    {runLink && <Link href={`/admin/runs/${runLink}`} className="inline-flex items-center gap-1 text-xs underline underline-offset-4">{t(locale, "Run details")}<ArrowUpRight size={12} aria-hidden="true" /></Link>}
    {summary && <div className="border border-border p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={14} className="text-[var(--brass)]" aria-hidden="true" />{t(locale, "Job summary")}</h3>
      {summary.jobId && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-start text-[10px]"><thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 text-start">{t(locale, "Job")}</th><th className="py-2 text-start">{t(locale, "Status")}</th><th className="py-2 text-start">{t(locale, "Processed")}</th><th className="py-2 text-start">{t(locale, "Failed")}</th></tr></thead><tbody><tr><td className="py-2 font-mono" dir="ltr">{summary.jobId}</td><td className="py-2">{t(locale, summary.status)}</td><td className="py-2">{formattedNumber(locale, summary.processed)}</td><td className="py-2">{formattedNumber(locale, summary.failed)}</td></tr></tbody></table></div>}
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([["Processed", summary.processed], ["Failed", summary.failed], ["Inserted", summary.inserted], ["Unchanged records", summary.unchanged], ["Status", summary.status]] as const).map(([label, value]) =>
          <div key={label}><dt className="text-[10px] text-muted-foreground">{t(locale, label)}</dt><dd className="mt-1 text-xs font-medium">{typeof value === "number" ? formattedNumber(locale, value) : t(locale, value)}</dd></div>)}
      </dl>
      {summary.jobId && canRun && bulkKind === "screen" && <button type="button" className={`${button} mt-3`} disabled={pending} onClick={() => bulk("screen", summary.jobId)}>{t(locale, "Resume screen job")}</button>}
    </div>}

    {!ingestion && <div className="border-t border-border pt-4">
      <h3 className="mb-3 text-xs font-semibold">{t(locale, "Screening runs")}</h3>
      {data.runs.filter((run) => !securityId || run.security_id === securityId).length === 0
        ? <div className="border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">{t(locale, "No screening runs recorded.")}</div>
        : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-start text-xs">
          <thead><tr className="border-b border-border text-muted-foreground">{(["Generated", "Version", "Status", "Hash", ""] as const).map((label, index) => <th key={`${label}-${index}`} className="px-2 py-2 text-start font-medium">{label ? t(locale, label) : ""}</th>)}</tr></thead>
          <tbody>{data.runs.filter((run) => !securityId || run.security_id === securityId).map((run) => {
            const unchanged = data.unchanged.some((entry) => entry.runId === run.id);
            return <tr key={run.id} className="border-b border-border align-middle">
              <td className="whitespace-nowrap px-2 py-2">{formatDate(run.generated_at, locale, { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="px-2 py-2">{run.methodology_version_label ?? "—"}</td>
              <td className="px-2 py-2"><StatusBadge status={run.status as StatusCode} className="px-2 py-0.5 text-[10px]" /></td>
              <td className="px-2 py-2"><span title={run.immutable_hash}>{ltr(run.immutable_hash.slice(0, 12))}</span>{unchanged && <span className="ms-2 inline-flex items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"><Check size={11} aria-hidden="true" />{t(locale, "Unchanged")}</span>}</td>
              <td className="px-2 py-2"><Link href={`/admin/runs/${run.id}`} className="inline-flex items-center gap-1 border border-border px-2 py-1.5 hover:bg-secondary">{t(locale, "Run details")}<ArrowUpRight size={12} aria-hidden="true" /></Link></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </div>}
  </section>;
}

type DetailProps = { detail: RunDetail; role: "admin" | "editor" };
export function ScreeningRunDetail({ detail, role }: DetailProps) {
  const locale = (useLocale() === "en" ? "en" : "ar") as Locale;
  const [pending, startTransition] = useTransition();
  const [verification, setVerification] = useState<Verification | null>(null);
  const [feedback, setFeedback] = useState("");
  const run = detail.run;
  const verify = () => {
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await verifyScreenAction(run.id);
        if (!result.ok) { setFeedback(t(locale, result.error)); return; }
        setVerification(result.verification);
        setFeedback(t(locale, !result.verification.valid ? "Verification failed."
          : result.verification.replaySupported ? "Verification passed." : "Hash verified."));
      } catch { setFeedback(t(locale, "The request failed. Reload and try again.")); }
    });
  };
  const jsonValue = (value: unknown) => <pre dir="ltr" className="max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-5 text-foreground">{JSON.stringify(value ?? null, null, 2)}</pre>;
  return <main className="mx-auto max-w-[1280px] space-y-5">
    <header className="border border-border bg-card p-5 sm:p-7">
      <Link href="/admin/securities" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{t(locale, "Securities and data")}<ArrowUpRight size={12} aria-hidden="true" /></Link>
      <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--byline)]">{t(locale, "SUHAIL / SCREENING RUN")}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">{run.company_name ?? run.ticker ?? t(locale, "Run details")} <bdi dir="ltr" className="font-mono text-base text-muted-foreground">({run.ticker ?? "—"})</bdi></h1>
          <p className="mt-2 text-sm text-muted-foreground">{run.methodology_name ?? "—"} · {run.methodology_version_label ?? "—"}</p><div className="mt-3"><StatusBadge status={run.status as StatusCode} /></div></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={pending} onClick={verify}><ShieldCheck size={14} aria-hidden="true" />{t(locale, "Verify")}</button>
        </div>
      </div>
      {role === "editor" && <p className="mt-3 text-xs text-muted-foreground">{t(locale, "Editors have read-only access.")}</p>}
      {feedback && <p role="status" className="mt-4 border-s-2 border-[var(--brass)] bg-secondary/40 px-3 py-2 text-xs"><LocalizedText>{feedback}</LocalizedText></p>}
      {verification && <div className="mt-4 space-y-3 border border-border p-4">
        <p className="flex items-center gap-2 text-xs font-semibold">{verification.valid ? <Check size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}{t(locale, "Verify")}</p>
        <dl className="grid gap-3 sm:grid-cols-3 text-xs">
          <div><dt className="text-muted-foreground">{t(locale, "Hash matches")}</dt><dd className="mt-1">{t(locale, verification.hashMatches ? "Yes" : "No")}</dd></div>
          <div><dt className="text-muted-foreground">{t(locale, "Replay matches")}</dt><dd className="mt-1">{verification.replaySupported
            ? t(locale, verification.replayMatches ? "Yes" : "No")
            : <span>{t(locale, "replay not supported for engine")} {ltr(verification.engineVersion)}</span>}</dd></div>
          <div><dt className="text-muted-foreground">{t(locale, "Stored hash")}</dt><dd className="mt-1 break-all">{ltr(verification.storedHash)}</dd></div>
        </dl>
        <p className="text-[10px] text-muted-foreground">{t(locale, "Computed hash")}: {ltr(verification.computedHash)}</p>
        <DiffTable locale={locale} verification={verification} />
      </div>}
    </header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {([["Generated", formatDate(run.generated_at, locale, { dateStyle: "medium", timeStyle: "short" })], ["Financial period", run.financial_period_label ?? "—"], ["Data as of", formatDate(run.data_as_of, locale)], ["Confidence", run.confidence ?? "—"], ["Data adequacy", run.data_adequacy], ["Engine version", run.engine_version ?? "—"], ["Calculation version", run.calculation_version ?? "—"]] as const).map(([label, value]) =>
        <div key={label} className="border border-border bg-card p-3"><p className="text-[10px] text-muted-foreground">{t(locale, label)}</p><p className="mt-1 break-words text-xs">{t(locale, value)}</p></div>)}
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      <DetailList locale={locale} title="Criteria" items={detail.criteria} empty="No criteria recorded." render={(item) => <div key={item.id} className="border-b border-border py-3 last:border-0">
        <div className="flex flex-wrap justify-between gap-2"><b>{item.criterion_label ?? displayLabel("criterionType", item.criterion_type, locale)}</b><span className="text-[10px]">{displayLabel("result", item.result, locale)}</span></div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <Pair locale={locale} label="Numerator" value={item.numerator_value} /><Pair locale={locale} label="Denominator" value={item.denominator_value} /><Pair locale={locale} label="Ratio" value={item.ratio} /><Pair locale={locale} label="Threshold" value={item.threshold} /><Pair locale={locale} label="Input states" value={item.input_states?.map(state => displayLabel("inputState", state, locale)).join(", ")} />
        </dl>
        {item.calculation_trace && <p className="mt-2 text-xs leading-5">{item.calculation_trace}</p>}
        {item.result_reason && <p className="mt-1 text-xs text-muted-foreground">{item.result_reason}</p>}
      </div>} />
      <DetailList locale={locale} title="Unknowns" items={detail.unknowns} empty="No unknowns recorded." render={(item) => <div key={item.id} className="border-b border-border py-3 last:border-0">
        <div className="flex flex-wrap justify-between gap-2"><b>{item.criterion_label ?? item.field_or_input}</b><span className="text-[10px]">{displayLabel("severity", item.severity, locale)}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{t(locale, "Field or input")}: {ltr(item.field_or_input)}</p>
        {item.why_missing && <p className="mt-1 text-xs">{item.why_missing}</p>}{item.effect && <p className="mt-1 text-xs text-muted-foreground">{item.effect}</p>}
      </div>} />
    </div>
    <DetailList locale={locale} title="Reasons" items={run.status_reasons ?? []} empty="No structured reasons recorded." render={(item, index) => <article key={index} className="border-b border-border py-3 last:border-0">
      <p className="text-sm leading-6"><bdi dir="auto">{renderReason(locale, item)}</bdi></p>
      <dl className="mt-3 grid gap-x-4 gap-y-2 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
        <ReasonValue locale={locale} label="Kind" value={item.kind} direction="ltr" />
        <ReasonValue locale={locale} label="Criterion" value={item.criterion_label} />
        <ReasonValue locale={locale} label="Criterion ID" value={item.criterion_id} direction="ltr" />
        <ReasonValue locale={locale} label="Reason code" value={item.reason_code} direction="ltr" />
        <ReasonValue locale={locale} label="Field" value={item.field} direction="ltr" />
        <ReasonValue locale={locale} label="Ratio" value={item.ratio} numeric />
        <ReasonValue locale={locale} label="Threshold" value={item.threshold} numeric />
        <ReasonValue locale={locale} label="Threshold unit" value={item.threshold_unit} direction="ltr" />
        <ReasonValue locale={locale} label="Borderline count" value={item.borderline_count} numeric />
        <ReasonValue locale={locale} label="Unknown count" value={item.unknown_count} numeric />
      </dl>
    </article>} />
    <DetailList locale={locale} title="Hash payload" items={[run.hash_payload]} empty="Hash payload" render={(item) => <div key="payload" className="max-h-[32rem] overflow-auto border border-border bg-secondary/25 p-4">{jsonValue(item)}</div>} />
  </main>;
}

function DetailList<T>({ locale, title, empty, items, render }: { locale: Locale; title: string; empty: string; items: T[]; render: (item: T, index: number) => ReactNode }) {
  return <section className="border border-border bg-card">
    <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">{t(locale, title)}</h2>
    <div className="p-4">{items.length ? items.map(render) : <p className="py-4 text-center text-xs text-muted-foreground">{t(locale, empty)}</p>}</div>
  </section>;
}
function Pair({ locale, label, value }: { locale: Locale; label: string; value: unknown }) {
  const numeric = typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
  return <div><dt>{t(locale, label)}</dt><dd className="mt-0.5 break-words text-foreground">{numeric ? formattedNumber(locale, value) : ltr(value)}</dd></div>;
}
function ReasonValue({ locale, label, value, numeric = false, direction }: { locale: Locale; label: string; value: unknown; numeric?: boolean; direction?: "ltr" }) {
  const display = value == null || value === "" ? "—" : numeric ? formattedNumber(locale, value) : direction ? ltr(value) : String(value);
  return <div className="min-w-0"><dt className="text-muted-foreground">{t(locale, label)}</dt><dd className="mt-0.5 break-words">{display}</dd></div>;
}
function DiffTable({ locale, verification }: { locale: Locale; verification: Verification }) {
  if (!verification.differences.length) return <p className="text-xs text-muted-foreground">{t(locale, "No differences recorded.")}</p>;
  return <div className="overflow-x-auto"><h3 className="mb-2 text-xs font-semibold">{t(locale, "Differences")}</h3><table className="w-full min-w-[480px] text-start text-[10px]">
    <thead><tr className="border-b border-border text-muted-foreground">{(["Path", "Expected", "Actual"] as const).map((label) => <th key={label} className="px-2 py-2 text-start">{t(locale, label)}</th>)}</tr></thead>
    <tbody>{verification.differences.map((diff, index) => <tr key={`${diff.path}-${index}`} className="border-b border-border align-top"><td className="px-2 py-2 font-mono" dir="ltr">{diff.path}</td><td className="max-w-[16rem] break-all px-2 py-2">{ltr(JSON.stringify(diff.expected))}</td><td className="max-w-[16rem] break-all px-2 py-2">{ltr(JSON.stringify(diff.actual))}</td></tr>)}</tbody>
  </table></div>;
}
