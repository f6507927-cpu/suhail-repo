"use client";

import { useState, useTransition, type ReactNode } from "react";
import { BookOpenText, Check, ChevronDown, FilePlus2, GitBranch, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { LocalizedText } from "@/components/foundation";
import type { MethodologyAdminData } from "@/lib/methodology/admin-data";
import { workflow, nextStage } from "@/lib/methodology/gates";
import type { Locale } from "@/components/accounts/types";
import type { MethodologyActionResult, MethodologyCommand } from "@/lib/methodology/commands";
import { governedText, GovernedCopy, type GovernedKey } from "./GovernedCopy";
import { AnalystCasesEditor, CriterionForm, MetadataForm, SourceAssociation, VersionForm } from "./MethodologyForms";
import { MethodologyReports } from "./MethodologyReports";
import { methodologyHref, type MethodologySelection } from "@/lib/methodology/navigation";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { reviewText } from "@/components/accounts/types";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { displayLabel } from "@/i18n/presentation";
import { enumDisplayLabel } from "./structured-labels";

type Props = {
  data: MethodologyAdminData;
  locale: Locale;
  role: "admin" | "editor";
  selection?: MethodologySelection;
  action: (command: MethodologyCommand) => Promise<MethodologyActionResult>;
};
type MethodologyRow = MethodologyAdminData["methodologies"][number];
type VersionRow = MethodologyAdminData["versions"][number];
type CriterionRow = MethodologyAdminData["criteria"][number];
const labelForVersion = (version: VersionRow) => version.version_label ?? version.version;

function formatDate(locale: Locale, value: Date | string | null) {
  return formatTimestamp(value, locale, { dateStyle: "medium", timeStyle: "short" });
}
function reviewError(locale: Locale, error: string) {
  return reviewText(locale, error);
}

function Metric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <dl className="border-s border-border ps-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </dl>
  );
}

export function AdminMethodologies({ data, locale, role, action, selection = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isAdmin = role === "admin";
  const [methodologyId, setMethodologyId] = useState(
    data.methodologies.find((method) => method.id === selection.methodology)?.id ?? data.methodologies[0]?.id ?? "");
  const initialVersions = data.versions.filter((item) => item.methodology_id === methodologyId);
  const [versionId, setVersionId] = useState(
    initialVersions.find((item) => item.id === selection.version)?.id ?? initialVersions[0]?.id ?? "");
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [showNewMetadata, setShowNewMetadata] = useState(false);
  const [editingVersion, setEditingVersion] = useState(false);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<CriterionRow | null>(null);
  const [showNewCriterion, setShowNewCriterion] = useState(false);
  const [workflowNote, setWorkflowNote] = useState("");
  const [productionNote, setProductionNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [focusedReportId, setFocusedReportId] = useState("");

  const currentMethod = data.methodologies.find((method) => method.id === methodologyId) ?? null;
  const currentVersions = currentMethod
    ? data.versions.filter((version) => version.methodology_id === currentMethod.id)
    : [];
  const currentVersion = currentVersions.find((version) => version.id === versionId) ?? currentVersions[0] ?? null;
  const currentCriteria = currentVersion
    ? data.criteria.filter((criterion) => criterion.methodology_version_id === currentVersion.id)
    : [];
  const currentReports = currentVersion
    ? data.reports.filter((report) => report.methodology_version_id === currentVersion.id)
    : [];
  const destination = currentVersion ? nextStage(currentVersion.workflow_status) : null;
  const canEditDraft = isAdmin && currentVersion?.workflow_status === "draft";
  const methodSelection = { methodology: currentMethod?.id };
  const methodHref = methodologyHref(locale, methodSelection, "methodology-record");
  const versionHref = methodologyHref(locale, { ...methodSelection, version: currentVersion?.id }, "version-record");
  const crumbs = [
    { label: reviewText(locale, "Methodologies"), href: methodologyHref(locale) },
    ...(currentMethod ? [{ label: currentMethod.name, href: methodHref }] : []),
    ...(currentVersion ? [{ label: labelForVersion(currentVersion), href: versionHref }] : []),
  ];
  // Keep selections reloadable without adding routes or changing authorization.
  const rememberSelection = (methodology: string, version?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("methodology", methodology);
    if (version) url.searchParams.set("version", version);
    else url.searchParams.delete("version");
    window.history.replaceState(null, "", url);
  };

  const chooseMethodology = (method: MethodologyRow) => {
    setMethodologyId(method.id);
    const next = data.versions.find((version) => version.methodology_id === method.id);
    setVersionId(next?.id ?? "");
    rememberSelection(method.id, next?.id);
    setEditingMetadata(false);
    setEditingVersion(false);
    setEditingCriterion(null);
    setShowNewVersion(false);
    setShowNewCriterion(false);
    setFeedback("");
    setFocusedReportId("");
  };

  const run = (
    command: MethodologyCommand,
    successKey: GovernedKey = "saved",
    onSuccess?: (result: MethodologyActionResult) => void,
  ) => {
    setFeedback("");
    startTransition(async () => {
      try {
        const result = await action(command);
        if (result.reportId) setFocusedReportId(result.reportId);
        if (result.ok) {
          if (command.operation === "metadata" && command.id === null && result.id) {
            setMethodologyId(result.id);
            setVersionId("");
          }
          if (command.operation === "version" && command.id === null && result.id) {
            setVersionId(result.id);
          }
          onSuccess?.(result);
          setFeedback(governedText(locale, successKey));
          router.refresh();
        } else {
          setFeedback(reviewError(locale, result.error || "The change was not accepted."));
          if (result.reportId) router.refresh();
        }
      } catch {
        setFeedback(reviewError(locale, "The request failed. Reload the record and try again."));
      }
    });
  };

  return (
    <section className="mx-auto max-w-[1280px]">
      <AdminBreadcrumbs locale={locale} items={crumbs.map((item, index) => index === crumbs.length - 1 ? { label: item.label } : item)} />
      <div className="relative overflow-hidden border border-border bg-card">
        <div className="flex flex-col gap-7 p-5 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs text-[var(--byline)]"><GovernedCopy id="workspaceLabel" /></p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl"><GovernedCopy id="methodologyManagement" /></h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground"><GovernedCopy id="adminIntro" /></p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex min-h-9 items-center gap-2 border border-border px-3 text-xs text-muted-foreground">
              {isAdmin ? <ShieldCheck size={14} strokeWidth={1.6} /> : <LockKeyhole size={14} strokeWidth={1.6} />}
              {reviewText(locale, role)}
            </span>
            {isAdmin && (
              <button type="button" onClick={() => { setShowNewMetadata((value) => !value); setEditingMetadata(false); }}
                className="inline-flex min-h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                <Plus aria-hidden="true" size={16} strokeWidth={1.6} /><GovernedCopy id="createMethodology" />
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-0 border-t border-border sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b border-border p-4 sm:border-b-0 sm:border-e">
            <BookOpenText aria-hidden="true" size={17} strokeWidth={1.6} className="text-[var(--byline)]" />
            <Metric label={<GovernedCopy id="methodologyRecords" />} value={<bdi dir="ltr" className="font-mono tabular-nums">{formatNumber(data.methodologies.length, locale)}</bdi>} />
          </div>
          <div className="flex items-center gap-3 border-b border-border p-4 sm:border-b-0 sm:border-e">
            <GitBranch aria-hidden="true" size={17} strokeWidth={1.6} className="text-[var(--byline)]" />
            <Metric label={<GovernedCopy id="versionRecords" />} value={<bdi dir="ltr" className="font-mono tabular-nums">{formatNumber(data.versions.length, locale)}</bdi>} />
          </div>
          <div className="flex items-center gap-3 p-4">
            <Check aria-hidden="true" size={17} strokeWidth={1.6} className="text-[var(--byline)]" />
            <Metric label={<GovernedCopy id="criteriaRecords" />} value={<bdi dir="ltr" className="font-mono tabular-nums">{formatNumber(data.criteria.length, locale)}</bdi>} />
          </div>
        </div>
      </div>

      {feedback && (
        <p role="status" className="mt-4 border-s-2 border-[var(--brass)] bg-card px-4 py-3 text-sm" lang={locale === "ar" ? "en" : undefined} dir={locale === "ar" ? "ltr" : undefined}>
          <LocalizedText>{feedback}</LocalizedText>
        </p>
      )}

      {showNewMetadata && isAdmin && (
        <section className="mt-6 border border-[var(--brass)] bg-card p-5 sm:p-7">
          <div className="mb-5">
            <p className="text-xs text-[var(--byline)]"><GovernedCopy id="newRecord" /></p>
            <h2 className="mt-2 text-xl"><GovernedCopy id="createMethodology" /></h2>
          </div>
          <MetadataForm onSave={(id, form) => {
            run({ operation: "metadata", id, data: form }, "metadataSaved", () => setShowNewMetadata(false));
          }} pending={pending} onCancel={() => setShowNewMetadata(false)} />
        </section>
      )}

      {data.methodologies.length === 0 ? (
        <div className="mt-6 grid gap-4 border border-dashed border-border bg-card p-8 text-center">
          <BookOpenText aria-hidden="true" size={22} className="mx-auto text-muted-foreground" strokeWidth={1.6} />
          <h2 className="text-lg"><GovernedCopy id="noMethodologies" /></h2>
          <p className="mx-auto max-w-lg text-sm leading-6 text-muted-foreground"><GovernedCopy id="noMethodologiesBody" /></p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="min-w-0">
            <div className="sticky top-4 border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs text-muted-foreground"><GovernedCopy id="methodologyIndex" /></p>
              </div>
              <nav aria-label={locale === "en" ? "Methodology records" : "⟦AR-REVIEW⟧ Methodology records"} className="max-h-[70vh] overflow-y-auto">
                {data.methodologies.map((method) => {
                  const active = method.id === methodologyId;
                  const versionCount = data.versions.filter((version) => version.methodology_id === method.id).length;
                  return (
                    <button key={method.id} type="button" onClick={() => chooseMethodology(method)}
                      aria-current={active ? "page" : undefined}
                      className={`block min-h-16 w-full border-b border-border px-4 py-3 text-start transition-colors ${active ? "border-s-[2px] border-s-[var(--brass)] bg-secondary" : "hover:bg-secondary/60"}`}>
                      <span className="block truncate text-sm font-medium">{method.name}</span>
                      <span className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                         <span>{displayLabel("methodType", method.type, locale)}</span><bdi className="font-mono tabular-nums" dir="ltr">{versionCount}</bdi>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {currentMethod && (
            <div className="min-w-0 space-y-5">
              <section id="methodology-record" className="border border-border bg-card">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--byline)]"><GovernedCopy id="methodologyMetadata" /></p>
                    <h2 className="mt-2 break-words text-2xl font-semibold">{currentMethod.name}</h2>
                    <p className="mt-2 font-mono text-xs text-muted-foreground" dir="ltr">/{currentMethod.slug}</p>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => setEditingMetadata((value) => !value)}
                      className="min-h-9 border border-border px-3 text-xs hover:bg-secondary"><GovernedCopy id={editingMetadata ? "closeEdit" : "editMetadata"} /></button>
                  )}
                </div>
                {editingMetadata && isAdmin ? (
                  <div className="p-5 sm:p-6">
                    <MetadataForm key={currentMethod.id} initial={currentMethod} pending={pending}
                      onSave={(id, form) => {
                         run({ operation: "metadata", id, data: form }, "metadataSaved", () => setEditingMetadata(false));
                      }}
                      onCancel={() => setEditingMetadata(false)} />
                  </div>
                ) : (
                  <dl className="grid gap-0 sm:grid-cols-2 xl:grid-cols-3">
                    <Meta label="publisher" value={currentMethod.publisher} />
                    <Meta label="shortLabel" value={currentMethod.short_label} />
                    <Meta label="sourceTitle" value={currentMethod.source_title} />
                    <Meta label="sourceUrl" value={currentMethod.source_url} ltr />
                    <Meta label="officialOrAdapted" value={displayLabel("methodSource", currentMethod.official_or_inspired, locale)} />
                    <Meta label="licensing" value={displayLabel("licence", currentMethod.licensing_status, locale)} />
                    <Meta label="verifiedBy" value={currentMethod.verified_by} />
                    <Meta label="verificationDate" value={currentMethod.verification_date ? formatTimestamp(currentMethod.verification_date, locale, { dateStyle: "medium" }) : null} />
                    <Meta label="scope" value={currentMethod.scope} />
                    <Meta label="notes" value={currentMethod.notes} />
                    <Meta label="type" value={displayLabel("methodType", currentMethod.type, locale)} />
                  </dl>
                )}
              </section>

              <section className="border border-border bg-card">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-5 sm:p-6">
                  <div>
                    <p className="text-xs text-[var(--byline)]"><GovernedCopy id="versionControl" /></p>
                    <h2 className="mt-2 text-xl"><GovernedCopy id="methodologyVersions" /></h2>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => { setShowNewVersion((value) => !value); setEditingVersion(false); }}
                      className="inline-flex min-h-9 items-center gap-2 border border-border px-3 text-xs hover:bg-secondary">
                      <FilePlus2 aria-hidden="true" size={14} strokeWidth={1.6} /><GovernedCopy id="newDraft" />
                    </button>
                  )}
                </div>
                {currentVersions.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-muted-foreground"><GovernedCopy id="noVersions" /></p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto border-b border-border p-3">
                    {currentVersions.map((version) => {
                      const active = version.id === currentVersion?.id;
                      return (
                        <button key={version.id} type="button" onClick={() => {
                          setVersionId(version.id); setEditingVersion(false); setEditingCriterion(null); setShowNewCriterion(false);
                          setShowNewVersion(false); setFeedback(""); setFocusedReportId("");
                          rememberSelection(currentMethod.id, version.id);
                        }}
                          className={`min-h-12 min-w-36 border px-3 py-2 text-start ${active ? "border-[var(--brass)] bg-secondary" : "border-border hover:bg-secondary/60"}`}>
                          <span className={`block ${version.version_label ? "text-sm" : "font-mono text-xs"}`} dir={version.version_label ? undefined : "ltr"}>{labelForVersion(version)}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{displayLabel("workflow", version.workflow_status, locale)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showNewVersion && isAdmin && (
                  <div className="border-b border-[var(--brass)] p-5 sm:p-6">
                    <h3 className="mb-4 text-lg"><GovernedCopy id="newDraft" /></h3>
                    <VersionForm clones={currentVersions} pending={pending}
                      onSave={(id, cloneId, form) => {
                        run(
                          { operation: "version", methodologyId: currentMethod.id, id, cloneId, data: form },
                          "draftSaved",
                          () => setShowNewVersion(false),
                        );
                      }}
                      onCancel={() => setShowNewVersion(false)} />
                  </div>
                )}

                {currentVersion && (
                  <div id="version-record" className="p-5 sm:p-6">
                    <nav aria-label={reviewError(locale, "Version sections")} className="mb-5 flex flex-wrap gap-4 text-sm">
                      <a href="#criteria-record" className="underline underline-offset-4"><GovernedCopy id="criteria" /></a>
                      <a href="#reports-title" className="underline underline-offset-4"><GovernedCopy id="reportArchive" /></a>
                    </nav>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">{labelForVersion(currentVersion)}</h3>
                          <span className={`border px-2 py-1 text-xs ${currentVersion.workflow_status === "draft" ? "border-[var(--brass)] text-[var(--brass-soft)]" : "border-border text-muted-foreground"}`}>{displayLabel("workflow", currentVersion.workflow_status, locale)}</span>
                          {currentVersion.production_enabled && <span className="border border-[var(--byline)] px-2 py-1 text-xs text-[var(--byline)]"><GovernedCopy id="productionEnabled" /></span>}
                          <span className={`border px-2 py-1 text-xs ${currentVersion.is_public ? "border-[var(--byline)] text-[var(--byline)]" : "border-border text-muted-foreground"}`}>
                            {currentVersion.is_public ? <GovernedCopy id="publicVisible" /> : <GovernedCopy id="notPublic" />}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          <GovernedCopy id="effectiveDate" /> · <bdi>{currentVersion.effective_date ? formatTimestamp(currentVersion.effective_date, locale, { dateStyle: "medium" }) : "—"}</bdi>
                          <span className="mx-2">/</span><GovernedCopy id="created" /> · <bdi>{formatDate(locale, currentVersion.created_at)}</bdi>
                        </p>
                        {currentVersion.changelog && <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{currentVersion.changelog}</p>}
                      </div>
                      {canEditDraft && (
                        <button type="button" onClick={() => setEditingVersion((value) => !value)}
                          className="min-h-9 self-start border border-border px-3 text-xs hover:bg-secondary"><GovernedCopy id={editingVersion ? "closeEdit" : "editDraft"} /></button>
                      )}
                    </div>

                    {editingVersion && canEditDraft && (
                      <div className="mt-5 border-t border-border pt-5">
                        <VersionForm key={currentVersion.id} initial={currentVersion} clones={[]} pending={pending}
                          onSave={(id, _cloneId, form) => {
                            run({ operation: "version", methodologyId: currentMethod.id, id, cloneId: null, data: form }, "draftSaved", () => setEditingVersion(false));
                          }} onCancel={() => setEditingVersion(false)} />
                      </div>
                    )}

                    <div className="mt-6 grid gap-5 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
                      <div>
                        <h4 className="mb-3 text-sm font-medium"><GovernedCopy id="sourceAssociation" /></h4>
                        <SourceAssociation version={currentVersion} parent={currentMethod} sources={data.sources} pending={pending} readOnly={!isAdmin}
                          onAssociate={(sourceId) => run({ operation: "source", versionId: currentVersion.id, sourceId }, "sourceAssociated")} />
                      </div>
                      {isAdmin && (
                        <div className="space-y-3 border-t border-border pt-5 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
                          <h4 className="text-sm font-medium"><GovernedCopy id="visibilityControl" /></h4>
                          <p className="text-xs leading-5 text-muted-foreground"><GovernedCopy id="visibilityHelp" /></p>
                          <button type="button" disabled={pending} onClick={() => {
                            const message = governedText(locale, currentVersion.is_public ? "confirmUnpublish" : "confirmPublish");
                            if (!window.confirm(message)) return;
                            run({ operation: "visibility", versionId: currentVersion.id, isPublic: !currentVersion.is_public }, "visibilitySaved");
                          }}
                            className={`min-h-10 border px-4 text-sm disabled:opacity-50 ${currentVersion.is_public ? "border-border text-muted-foreground hover:bg-secondary" : "border-[var(--byline)] text-[var(--byline)] hover:bg-secondary"}`}>
                            <GovernedCopy id={currentVersion.is_public ? "unpublishVersion" : "publishVersion"} />
                          </button>
                        </div>
                      )}
                    </div>

                    <section id="criteria-record" className="mt-7 border-t border-border pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-medium"><GovernedCopy id="criteria" /></h4>
                          <p className="mt-1 text-xs text-muted-foreground"><GovernedCopy id="criterionIdentityHelp" /></p>
                        </div>
                        {canEditDraft && (
                          <button type="button" onClick={() => { setShowNewCriterion((value) => !value); setEditingCriterion(null); }}
                            className="inline-flex min-h-9 items-center gap-2 border border-border px-3 text-xs hover:bg-secondary">
                            <Plus aria-hidden="true" size={14} strokeWidth={1.6} /><GovernedCopy id="addCriterion" />
                          </button>
                        )}
                      </div>
                      {currentVersion.workflow_status !== "draft" && (
                        <p className="mt-4 border-s-2 border-[var(--brass)] bg-background px-4 py-3 text-sm text-muted-foreground"><GovernedCopy id="finalizedContentReadOnly" /></p>
                      )}
                      {showNewCriterion && canEditDraft && (
                        <div className="mt-4 border border-[var(--brass)] p-4 sm:p-5">
                          <h5 className="mb-4 text-sm font-medium"><GovernedCopy id="addCriterion" /></h5>
                          <CriterionForm pending={pending} onSave={(id, form) => {
                            run({ operation: "criterion", versionId: currentVersion.id, id, data: form }, "criterionSaved", () => setShowNewCriterion(false));
                          }} onCancel={() => setShowNewCriterion(false)} />
                        </div>
                      )}
                      {currentCriteria.length === 0 ? (
                        <p className="mt-4 border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"><GovernedCopy id="noCriteria" /></p>
                      ) : (
                        <ol className="mt-4 divide-y divide-border border-y border-border">
                          {currentCriteria.map((criterion, index) => (
                            <li key={criterion.id} className="py-4">
                              {editingCriterion?.id === criterion.id ? (
                                <div className="px-1">
                                  <CriterionForm key={criterion.id} initial={criterion} pending={pending}
                                    onSave={(id, form) => {
                                      run({ operation: "criterion", versionId: currentVersion.id, id, data: form }, "criterionSaved", () => setEditingCriterion(null));
                                    }}
                                    onDelete={() => {
                                      const prompt = governedText(locale, "confirmDeleteCriterion");
                                      if (window.confirm(prompt)) {
                                        run({ operation: "deleteCriterion", versionId: currentVersion.id, id: criterion.id }, "criterionDeleted", () => setEditingCriterion(null));
                                      }
                                    }}
                                    onCancel={() => setEditingCriterion(null)} />
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-start justify-between gap-4 px-1">
                                  <div className="flex min-w-0 gap-3">
                                    <span className="pt-1 font-mono text-xs text-[var(--byline)]" dir="ltr">{String(index + 1).padStart(2, "0")}</span>
                                    <div className="min-w-0">
                                      <h5 className="break-words font-medium">{criterion.label}</h5>
                              <p className="mt-1 text-xs text-muted-foreground"><span>{displayLabel("criterionType", criterion.criterion_type, locale)}</span> · <bdi dir="ltr" className="font-mono">{criterion.id}</bdi></p>
                                      {criterion.definition && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{criterion.definition}</p>}
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span className="border border-border px-2 py-1 text-xs">
                                          <bdi dir="ltr" className="font-mono tabular-nums">{criterion.threshold === null ? "null" : criterion.threshold}</bdi>
                                          <span className="ms-2">{displayLabel("thresholdUnit", criterion.threshold_unit, locale)} · {displayLabel("direction", criterion.threshold_direction, locale)}</span>
                                        </span>
                                        <span className="border border-border px-2 py-1 text-xs text-muted-foreground"><GovernedCopy id="requiredInputsDerived" />: {criterion.required_inputs.map((input) => enumDisplayLabel("lineItem", input, locale)).join(", ") || "—"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  {canEditDraft && <button type="button" onClick={() => { setEditingCriterion(criterion); setShowNewCriterion(false); }}
                                    className="min-h-9 border border-border px-3 text-xs hover:bg-secondary"><GovernedCopy id="editCriterion" /></button>}
                                </div>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>

                    {currentVersion.workflow_status === "draft" ? (
                      <section className="mt-7 border-t border-border pt-5">
                        <div className="mb-4">
                          <h4 className="font-medium"><GovernedCopy id="analystCases" /></h4>
                          <p className="mt-1 text-xs text-muted-foreground"><GovernedCopy id="analystCasesHint" /></p>
                        </div>
                        <AnalystCasesEditor key={currentVersion.id} version={currentVersion} criteria={currentCriteria} pending={pending} readOnly={!isAdmin}
                          onSave={(cases) => run({ operation: "cases", versionId: currentVersion.id, data: cases }, "casesSaved")} />
                      </section>
                    ) : (
                      <section className="mt-7 border-t border-border pt-5">
                        <p className="border-s-2 border-border bg-background px-4 py-3 text-sm text-muted-foreground"><GovernedCopy id="casesFinalized" /></p>
                      </section>
                    )}

                    <section className="mt-7 border-t border-border pt-5">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center border border-border"><ShieldCheck aria-hidden="true" size={16} strokeWidth={1.6} className="text-[var(--byline)]" /></div>
                        <div>
                          <h4 className="font-medium"><GovernedCopy id="workflow" /></h4>
                          <p className="mt-1 text-xs text-muted-foreground"><GovernedCopy id="workflowSequential" /></p>
                        </div>
                      </div>
                      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                        {workflow.map((stage, index) => {
                          const complete = workflow.indexOf(currentVersion.workflow_status as typeof workflow[number]) >= index;
                          const current = currentVersion.workflow_status === stage;
                          return (
                            <li key={stage} className={`min-h-14 border px-3 py-2 ${current ? "border-[var(--brass)] bg-secondary" : complete ? "border-[var(--byline)]/50" : "border-border"}`}>
                              <span className="block font-mono text-[9px] text-muted-foreground" dir="ltr">{String(index + 1).padStart(2, "0")}</span>
                              <span className={`mt-1 block break-words text-xs ${current ? "text-[var(--brass-soft)]" : complete ? "text-[var(--byline)]" : "text-muted-foreground"}`}>{displayLabel("workflow", stage, locale)}</span>
                            </li>
                          );
                        })}
                      </ol>
                      {currentVersion.workflow_history.length > 0 && (
                        <details className="mt-4 border border-border">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs">
                            <GovernedCopy id="workflowHistory" /><ChevronDown aria-hidden="true" size={14} strokeWidth={1.6} />
                          </summary>
                          <ol className="divide-y divide-border border-t border-border">
                            {currentVersion.workflow_history.map((event, index) => (
                              <li key={`${event.at}-${index}`} className="grid gap-2 px-3 py-3 text-xs sm:grid-cols-[minmax(8rem,0.6fr)_minmax(8rem,0.6fr)_1fr]">
                                <span>{displayLabel("workflow", event.from ?? event.status, locale)} → {displayLabel("workflow", event.to ?? event.status, locale)}</span>
                                <bdi className="text-muted-foreground">{formatDate(locale, event.at)}</bdi>
                                <span className="min-w-0 break-all text-muted-foreground">
                                  {event.operation && <code className="me-2 font-mono text-[10px]" dir="ltr">{event.operation}</code>}
                                  {event.note}
                                  {event.actor && <code className="ms-2 font-mono text-[10px]" dir="ltr">{event.actor}</code>}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}

                      {isAdmin && destination && (
                        <div className="mt-5 grid gap-4 border border-border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              <GovernedCopy id="nextWorkflowTarget" />: <bdi className="ms-1 text-[var(--brass-soft)]">{displayLabel("workflow", destination, locale)}</bdi>
                            </p>
                            <label htmlFor="workflow-note" className="block text-xs text-muted-foreground">
                              <span className="mb-1.5 block"><GovernedCopy id="workflowReviewNote" /></span>
                              <textarea id="workflow-note" rows={2} value={workflowNote} onChange={(event) => setWorkflowNote(event.target.value)}
                                className="w-full border border-input bg-card p-3 text-sm text-foreground" />
                            </label>
                          </div>
                           <button type="button" disabled={pending || (destination === "human_reviewed" && !workflowNote.trim())} onClick={() => {
                             run(
                               { operation: "transition", versionId: currentVersion.id, target: destination, note: workflowNote },
                               "workflowAdvanced",
                               () => setWorkflowNote(""),
                             );
                           }} className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                            <GovernedCopy id="advanceWorkflow" />
                          </button>
                        </div>
                      )}

                      {isAdmin && currentVersion.workflow_status === "approved" && !currentVersion.production_enabled && (
                        <div className="mt-4 grid gap-4 border border-[var(--brass)] bg-background p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <label htmlFor="production-note" className="block text-xs text-muted-foreground">
                            <span className="mb-1.5 block"><GovernedCopy id="productionOperationNote" /></span>
                            <textarea id="production-note" rows={2} value={productionNote} onChange={(event) => setProductionNote(event.target.value)}
                              className="w-full border border-input bg-card p-3 text-sm text-foreground" />
                          </label>
                           <button type="button" disabled={pending || !productionNote.trim()} onClick={() => {
                            if (!window.confirm(governedText(locale, "confirmProduction"))) return;
                             run({ operation: "production", versionId: currentVersion.id, note: productionNote }, "productionEnabled", () => setProductionNote(""));
                          }} className="min-h-11 border border-[var(--brass)] px-4 text-sm text-[var(--brass-soft)] hover:bg-secondary disabled:opacity-50">
                            <GovernedCopy id="enableProduction" />
                          </button>
                        </div>
                      )}
                    </section>

                    <MethodologyReports reports={currentReports} locale={locale} focusId={focusedReportId} />
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Meta({ label, value, ltr = false }: { label: GovernedKey; value: string | null; ltr?: boolean }) {
  return (
    <div className="border-b border-border px-5 py-4 sm:px-6">
      <dt className="text-xs text-muted-foreground"><GovernedCopy id={label} /></dt>
      <dd className={`mt-1 break-words text-sm ${ltr ? "font-mono text-xs" : ""}`} dir={ltr ? "ltr" : undefined}>{value || "—"}</dd>
    </div>
  );
}
