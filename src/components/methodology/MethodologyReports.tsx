"use client";
import { formatNumber, formatTimestamp } from "@/lib/format";

import type { MethodologyAdminData } from "@/lib/methodology/admin-data";
import { GovernedCopy } from "./GovernedCopy";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { reviewText } from "@/components/accounts/types";
import { LocalizedText } from "@/components/foundation";
import { displayLabel } from "@/i18n/presentation";

type Report = MethodologyAdminData["reports"][number];
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown) => typeof value === "string" ? value : "";
function ErrorText({ value }: { value: unknown }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  return <LocalizedText>{reviewText(locale, string(value))}</LocalizedText>;
}
const bool = (value: unknown) => value === true;
const json = (value: unknown) => {
  try { return JSON.stringify(value ?? null, null, 2); } catch { return "null"; }
};
const number = (value: unknown) => typeof value === "number" ? formatNumber(value, "en", { maximumFractionDigits: 6 }) : "—";
const screeningStatuses = ["passes_selected_methodology", "fails_selected_methodology", "requires_review", "insufficient_data"] as const;
function isScreeningStatus(value: string): value is (typeof screeningStatuses)[number] {
  return screeningStatuses.some(status => status === value);
}

function ResultValue({ value }: { value: unknown }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const statusText = useTranslations("status");
  if (typeof value === "string") {
    return <LocalizedText>{isScreeningStatus(value) ? statusText(value) : displayLabel("result", value, locale)}</LocalizedText>;
  }
  if (typeof value === "boolean") return <LocalizedText>{reviewText(locale, value ? "Yes" : "No")}</LocalizedText>;
  if (typeof value === "number") return <bdi dir="ltr" className="font-mono tabular-nums">{number(value)}</bdi>;
  return <span>—</span>;
}

function Value({ value }: { value: unknown }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "number") return <bdi dir="ltr" className="font-mono tabular-nums">{number(value)}</bdi>;
  if (typeof value === "boolean") return <LocalizedText>{reviewText(locale, value ? "Yes" : "No")}</LocalizedText>;
  return <span>{String(value)}</span>;
}

function CoverageGaps({ payload }: { payload: JsonRecord }) {
  const locale = useLocale() === "ar" ? "ar" : "en";
  const gaps = array(payload.coverageGaps).map(record).filter((item): item is JsonRecord => !!item);
  const coverage = array(payload.coverage).map(record).filter((item): item is JsonRecord => !!item);
  return (
    <section className="mt-5 border border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border bg-secondary px-4 py-3">
        <h3 className="font-medium"><GovernedCopy id="coverageGaps" /></h3>
        <span className={`text-xs ${gaps.length ? "text-[var(--brass-soft)]" : "text-[var(--byline)]"}`}>
          {formatNumber(gaps.length, "en")} / {formatNumber(coverage.length, "en")}
        </span>
      </div>
      {gaps.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground"><GovernedCopy id="noCoverageGaps" /></p>
      ) : (
        <ul className="divide-y divide-border">
          {gaps.map((gap, index) => (
            <li key={`${string(gap.id)}-${index}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)]">
              <div>
                <p className="font-medium">{string(gap.label) || <GovernedCopy id="unnamedCriterion" />}</p>
                <code className="mt-1 block break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{string(gap.id)}</code>
              </div>
              <div className="flex flex-wrap content-start gap-2">
                {array(gap.missing).map((outcome) => (
                  <span key={String(outcome)} className="border border-[var(--brass)] px-2 py-1 text-xs text-[var(--brass-soft)]">
                    <ResultValue value={outcome} />
                  </span>
                ))}
                <span className="w-full text-xs text-muted-foreground">
                  <GovernedCopy id="requiredCoverage" />: {array(gap.required).map((value) => displayLabel("result", String(value), locale)).join(", ") || "—"}
                  <span className="ms-3"><GovernedCopy id="observedCoverage" />: {array(gap.observed).map((value) => displayLabel("result", String(value), locale)).join(", ") || "—"}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TestReport({ payload }: { payload: JsonRecord }) {
  const cases = array(payload.analystCases).map(record).filter((item): item is JsonRecord => !!item);
  const goldens = array(payload.sharedEngineGoldens).map(record).filter((item): item is JsonRecord => !!item);
  return (
    <div className="space-y-5">
      <CoverageGaps payload={payload} />
      <section className="border border-border">
        <h3 className="border-b border-border bg-secondary px-4 py-3 font-medium"><GovernedCopy id="analystCaseResults" /></h3>
        {cases.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">—</p> : (
          <div className="divide-y divide-border">
            {cases.map((test, index) => {
              const outcomes = array(test.outcomes).map(record).filter((item): item is JsonRecord => !!item);
              return (
                <article key={`${string(test.name)}-${index}`} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-medium">{string(test.name) || <GovernedCopy id="unnamedCase" />}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <GovernedCopy id="aggregateStatus" />: <ResultValue value={test.expectedStatus} />
                        <span className="mx-2">→</span><ResultValue value={test.actualStatus} />
                      </p>
                    </div>
                    <span className={`border px-2 py-1 text-xs ${bool(test.passed) ? "border-[var(--byline)] text-[var(--byline)]" : "border-border text-muted-foreground"}`}>
                      <GovernedCopy id={bool(test.passed) ? "passed" : "failed"} />
                    </span>
                  </div>
                  {outcomes.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-start text-xs">
                        <thead><tr className="border-b border-border text-muted-foreground">
                          <th className="py-2 pe-3 text-start font-medium"><GovernedCopy id="criterion" /></th>
                          <th className="py-2 pe-3 text-start font-medium"><GovernedCopy id="expected" /></th>
                          <th className="py-2 pe-3 text-start font-medium"><GovernedCopy id="actual" /></th>
                          <th className="py-2 text-start font-medium"><GovernedCopy id="match" /></th>
                        </tr></thead>
                        <tbody>{outcomes.map((outcome, outcomeIndex) => (
                          <tr key={`${string(outcome.id)}-${outcomeIndex}`} className="border-b border-border/60">
                            <td className="py-2 pe-3">
                              <span>{string(outcome.label) || <GovernedCopy id="unnamedCriterion" />}</span>
                              <code className="mt-1 block break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{string(outcome.id)}</code>
                            </td>
                            <td className="py-2 pe-3"><ResultValue value={outcome.expected} /></td>
                            <td className="py-2 pe-3"><ResultValue value={outcome.actual} /></td>
                            <td className="py-2"><GovernedCopy id={bool(outcome.matched) ? "matched" : "different"} /></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                  {string(test.error) && <p className="mt-2 text-xs text-[var(--brass-soft)]"><ErrorText value={test.error} /></p>}
                  {array(test.unexpectedIds).length > 0 && <p className="mt-2 break-all font-mono text-xs text-[var(--brass-soft)]" dir="ltr">{array(test.unexpectedIds).join(", ")}</p>}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="border border-border">
        <h3 className="border-b border-border bg-secondary px-4 py-3 font-medium"><GovernedCopy id="sharedGoldenRegressions" /></h3>
        <div className="divide-y divide-border">
          {goldens.map((golden) => (
            <details key={string(golden.name)} className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="font-mono text-xs" dir="ltr">{string(golden.name)}</span>
                <span className={`text-xs ${bool(golden.passed) ? "text-[var(--byline)]" : "text-muted-foreground"}`}><GovernedCopy id={bool(golden.passed) ? "passed" : "failed"} /></span>
              </summary>
              <dl className="grid gap-3 border-t border-border bg-background px-4 py-4 text-xs sm:grid-cols-2">
                <div><dt className="text-muted-foreground"><GovernedCopy id="expectedHash" /></dt><dd className="mt-1 break-all font-mono" dir="ltr">{string(golden.expectedHash) || "—"}</dd></div>
                <div><dt className="text-muted-foreground"><GovernedCopy id="actualHash" /></dt><dd className="mt-1 break-all font-mono" dir="ltr">{string(golden.actualHash) || "—"}</dd></div>
                <div><dt className="text-muted-foreground"><GovernedCopy id="actualStatus" /></dt><dd className="mt-1"><ResultValue value={golden.actualStatus} /></dd></div>
                {string(golden.error) && <div className="text-[var(--brass-soft)]"><ErrorText value={golden.error} /></div>}
              </dl>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusMatrix({ value }: { value: unknown }) {
  const matrix = record(value) ?? {};
  const rows = Object.entries(matrix);
  const columns = [...new Set(rows.flatMap(([, row]) => Object.keys(record(row) ?? {})))];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-start text-xs">
        <thead className="bg-secondary text-muted-foreground">
          <tr><th className="p-3 text-start font-medium"><GovernedCopy id="priorStatus" /></th>
            {columns.map((column) => <th key={column} className="p-3 text-start font-medium"><ResultValue value={column} /></th>)}</tr>
        </thead>
        <tbody>{rows.map(([status, row]) => (
          <tr key={status} className="border-t border-border">
            <th scope="row" className="p-3 text-start font-normal"><ResultValue value={status} /></th>
            {columns.map((column) => <td key={column} className="p-3 font-mono tabular-nums" dir="ltr"><Value value={record(row)?.[column] ?? 0} /></td>)}
          </tr>
        ))}</tbody>
      </table>
      {rows.length === 0 && <p className="px-4 py-4 text-sm text-muted-foreground"><GovernedCopy id="noComparableUniverse" /></p>}
    </div>
  );
}

function ImpactReport({ payload }: { payload: JsonRecord }) {
  const drivers = array(payload.drivingCriteria).map(record).filter((item): item is JsonRecord => !!item);
  const securities = array(payload.securities).map(record).filter((item): item is JsonRecord => !!item);
  const borderline = securities.flatMap((security) =>
    array(security.borderline).map(record).filter((item): item is JsonRecord => !!item)
      .map((criterion) => ({ ticker: string(security.ticker), criterion })),
  );
  return (
    <div className="space-y-5">
      <section className="border border-border">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border bg-secondary px-4 py-3">
          <h3 className="font-medium"><GovernedCopy id="transitionMatrix" /></h3>
          <span className="text-xs text-muted-foreground"><GovernedCopy id="baseline" />: {string(payload.baselineLabel) || <GovernedCopy id="noneConfigured" />}</span>
        </div>
        {!!payload.baselineNote && <p className="px-4 py-3 text-sm text-muted-foreground"><ErrorText value={payload.baselineNote} /></p>}
        {!!payload.baselineError && <p className="px-4 py-3 text-sm text-destructive"><ErrorText value={payload.baselineError} /></p>}
        <StatusMatrix value={payload.transitionMatrix} />
      </section>

      <section className="border border-border">
        <h3 className="border-b border-border bg-secondary px-4 py-3 font-medium"><GovernedCopy id="drivingCriteria" /></h3>
        {drivers.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">—</p> : (
          <ol className="divide-y divide-border">
            {drivers.map((driver, index) => (
              <li key={`${string(driver.id)}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span>{string(driver.label) || <GovernedCopy id="unnamedCriterion" />}</span>
                <span className="flex items-center gap-3">
                  <code className="max-w-64 break-all font-mono text-[10px] text-muted-foreground" dir="ltr">{string(driver.id)}</code>
                  <bdi dir="ltr" className="font-mono tabular-nums">{number(driver.count)}</bdi>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border border-border">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border bg-secondary px-4 py-3">
          <h3 className="font-medium"><GovernedCopy id="borderlineCases" /></h3>
          <span className="font-mono text-xs" dir="ltr">{formatNumber(borderline.length, "en")}</span>
        </div>
        {borderline.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">—</p> : (
          <ul className="divide-y divide-border">
            {borderline.map(({ ticker, criterion }, index) => (
              <li key={`${ticker}-${string(criterion.criterionId)}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span><bdi dir="ltr" className="me-3 font-mono">{ticker}</bdi>{string(criterion.label)}</span>
                  <span className="text-xs"><GovernedCopy id="ratio" /> <Value value={criterion.ratio} /> / <GovernedCopy id="threshold" /> <Value value={criterion.threshold} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-border">
        <h3 className="border-b border-border bg-secondary px-4 py-3 font-medium"><GovernedCopy id="securityDiffs" /></h3>
        {securities.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">—</p> : (
          <div className="divide-y divide-border">
            {securities.map((security, index) => {
              const changed = array(security.criteria).map(record).filter((item): item is JsonRecord => !!item);
              const oldResults = array(security.oldCriteria).map(record).filter((item): item is JsonRecord => !!item);
              const newResults = array(security.newCriteria).map(record).filter((item): item is JsonRecord => !!item);
              return (
                <details key={`${string(security.securityId)}-${index}`} className="group">
                  <summary className="grid cursor-pointer list-none gap-2 px-4 py-4 sm:grid-cols-[minmax(8rem,0.6fr)_1fr_auto] sm:items-center">
                    <span className="font-mono text-sm" dir="ltr">{string(security.ticker) || <GovernedCopy id="unidentifiedSecurity" />}</span>
                    <span className="text-xs text-muted-foreground">
                      <ResultValue value={security.oldStatus} /> <span className="mx-2">→</span> <ResultValue value={security.newStatus} />
                    </span>
                  <span className={`text-xs ${string(security.error) ? "text-[var(--brass-soft)]" : "text-muted-foreground"}`}>
                      {string(security.error) ? <ErrorText value={security.error} /> : <><bdi dir="ltr">{formatNumber(changed.length, "en")}</bdi> <GovernedCopy id="criterionChanges" /></>}
                    </span>
                  </summary>
                  {string(security.error) ? <p className="border-t border-border px-4 py-3 text-sm text-[var(--brass-soft)]"><ErrorText value={security.error} /></p> : (
                    <div className="space-y-4 border-t border-border bg-background px-4 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <CriterionSnapshot titleKey="previousCriteria" values={oldResults} />
                        <CriterionSnapshot titleKey="candidateCriteria" values={newResults} />
                      </div>
                      {changed.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-sm text-muted-foreground"><GovernedCopy id="changedCriteria" /></h4>
                          <ul className="space-y-2">
                            {changed.map((criterion, changeIndex) => (
                              <li key={`${string(criterion.criterionId)}-${changeIndex}`} className="border border-border p-3 text-xs">
                                <p className="font-medium">{string(criterion.label)} <code className="ms-2 font-mono text-[10px] text-muted-foreground" dir="ltr">{string(criterion.criterionId)}</code></p>
                                <p className="mt-2 text-muted-foreground">
                                  <GovernedCopy id="result" />: <ResultValue value={criterion.result} />
                                  <span className="mx-2">·</span><GovernedCopy id="ratio" />: <Value value={criterion.ratio} />
                                  <span className="mx-2">·</span><GovernedCopy id="threshold" />: <Value value={criterion.threshold} />
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <details className="border border-border">
                        <summary className="cursor-pointer px-3 py-2 text-xs"><GovernedCopy id="retainedEvidence" /></summary>
                        <pre className="max-h-72 overflow-auto border-t border-border p-3 font-mono text-[10px] leading-5" dir="ltr">{json({ oldUnknowns: security.oldUnknowns, newUnknowns: security.newUnknowns, inputs: security.inputs })}</pre>
                      </details>
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function CriterionSnapshot({ titleKey, values }: { titleKey: "previousCriteria" | "candidateCriteria"; values: JsonRecord[] }) {
  return (
    <section className="border border-border">
      <h4 className="border-b border-border px-3 py-2 text-xs text-muted-foreground"><GovernedCopy id={titleKey} /></h4>
      <ul className="divide-y divide-border">
        {values.map((criterion, index) => (
          <li key={`${string(criterion.criterionId)}-${index}`} className="px-3 py-2 text-xs">
            <p>{string(criterion.label)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <ResultValue value={criterion.result} /> · <bdi dir="ltr" className="font-mono tabular-nums">{number(criterion.ratio)} / {number(criterion.threshold)}</bdi>
            </p>
          </li>
        ))}
        {values.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">—</li>}
      </ul>
    </section>
  );
}

export function MethodologyReports({
  reports, locale, focusId,
}: {
  reports: Report[]; locale: "ar" | "en"; focusId?: string;
}) {
  const ordered = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <section aria-labelledby="reports-title" className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
              <p className="text-xs text-muted-foreground"><GovernedCopy id="governanceReports" /></p>
          <h3 id="reports-title" className="mt-2 text-xl"><GovernedCopy id="reportArchive" /></h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{formatNumber(ordered.length, locale)}</span>
      </div>
      {ordered.length === 0 ? (
        <p className="mt-4 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"><GovernedCopy id="noReports" /></p>
      ) : (
        <div className="mt-4 space-y-3">
          {ordered.map((report) => {
            const payload = record(report.payload) ?? {};
            const passed = bool(payload.passed);
            return (
              <details key={report.id} open={report.id === focusId} className="border border-border bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`size-2 shrink-0 rounded-full ${passed ? "bg-[var(--byline)]" : "bg-border"}`} />
                    <span>
                      <span className="block text-sm">{report.kind === "test" ? <GovernedCopy id="testReport" /> : <GovernedCopy id="impactReport" />}</span>
                      <time className="mt-1 block text-xs text-muted-foreground" dateTime={new Date(report.created_at).toISOString()}>{formatTimestamp(report.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}</time>
                    </span>
                  </span>
                  <span className={`text-sm ${passed ? "text-[var(--byline)]" : "text-muted-foreground"}`}><GovernedCopy id={passed ? "passed" : "reviewFailed"} /></span>
                </summary>
                <div className="border-t border-border p-4 sm:p-5">
                  <dl className="mb-5 grid gap-3 border-b border-border pb-4 text-xs sm:grid-cols-3">
                    <div><dt className="text-muted-foreground"><GovernedCopy id="engineVersion" /></dt><dd className="mt-1 font-mono" dir="ltr">{string(payload.engineVersion) || "—"}</dd></div>
                    <div><dt className="text-muted-foreground"><GovernedCopy id="calculationVersion" /></dt><dd className="mt-1 font-mono" dir="ltr">{string(payload.calculationVersion) || "—"}</dd></div>
                    <div><dt className="text-muted-foreground"><GovernedCopy id="reportIdentity" /></dt><dd className="mt-1 break-all font-mono" dir="ltr">{report.id}</dd></div>
                  </dl>
                  {report.kind === "test" ? <TestReport payload={payload} /> : <ImpactReport payload={payload} />}
                  <details className="mt-5 border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-xs"><GovernedCopy id="fullReportEvidence" /></summary>
                    <pre className="max-h-[32rem] overflow-auto border-t border-border bg-background p-4 font-mono text-[10px] leading-5" dir="ltr">{json(payload)}</pre>
                  </details>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
