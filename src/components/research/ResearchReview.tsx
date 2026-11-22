"use client";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import type { ResearchDraft, ModelDraft } from "@/ai/research/draft";
import type { ResearchPacket, ValidationIssue } from "@/ai/research/contracts";
import { CHECKLIST, EDIT_REASONS, type ResearchState } from "@/lib/research/contracts";
import { TRANSITIONS } from "@/lib/research/workflow";
import type { Locale } from "../accounts/types";
import { Heading, Message, ResearchFrame, reviewText, type ResearchAction } from "./research-ui";

export interface ResearchReviewProps {
  locale: Locale;
  draft: { id: string; state: ResearchState; ai_output: ResearchDraft | null; analyst_text: ResearchDraft | null; validation_results: ValidationIssue[]; failure_reason: string | null; text_hash: string | null };
  packet: ResearchPacket;
  activeAnalyst: boolean;
  saveAction: ResearchAction;
  transitionAction: ResearchAction;
  regenerateAction: ResearchAction;
}
function modelOnly(draft: ResearchDraft | null): ModelDraft | null {
  if (!draft) return null;
  return structuredClone({
    title: draft.title,
    summary: draft.summary,
    plain_summary: draft.plain_summary,
    business_overview: draft.business_overview,
    financial_highlights: draft.financial_highlights,
    strengths: draft.strengths,
    risks: draft.risks,
    valuation_discussion: draft.valuation_discussion,
    analyst_view: draft.analyst_view,
    what_would_change_the_view: draft.what_would_change_the_view,
    open_questions_for_analyst: draft.open_questions_for_analyst,
    data_limitations: draft.data_limitations,
  });
}
const proseKeys = ["title", "summary", "business_overview", "valuation_discussion"] as const;
const arrayKeys = ["financial_highlights", "strengths", "risks", "what_would_change_the_view", "open_questions_for_analyst", "data_limitations"] as const;
type TextSlot = { location: string; ar: string; en: string; cites?: string[]; covers?: string[] };

function slotsOf(draft: ModelDraft | null): TextSlot[] {
  if (!draft) return [];
  const result: TextSlot[] = proseKeys.map(key => ({ location: key, ar: draft[key].ar, en: draft[key].en }));
  draft.plain_summary.forEach((line, i) => result.push({ location: `plain_summary.${i}`, ar: line.ar, en: line.en }));
  arrayKeys.forEach(key => draft[key].forEach((item, i) => result.push({ location: `${key}.${i}`, ar: item.text.ar, en: item.text.en, cites: item.cites, covers: "covers" in item && Array.isArray(item.covers) ? item.covers as string[] : undefined })));
  draft.analyst_view.reasons.forEach((item, i) => result.push({ location: `analyst_view.reasons.${i}`, ar: item.text.ar, en: item.text.en, cites: item.cites }));
  return result;
}
function setSlot(draft: ModelDraft, slot: TextSlot, lang: "ar" | "en", value: string): ModelDraft {
  const next = structuredClone(draft);
  const [key, rawIndex] = slot.location.split(".");
  if (key === "title" || key === "summary" || key === "business_overview" || key === "valuation_discussion") next[key][lang] = value;
  else if (key === "plain_summary") next.plain_summary[Number(rawIndex)][lang] = value;
  else if (key === "analyst_view") next.analyst_view.reasons[Number(rawIndex)].text[lang] = value;
  else {
    const list = next[key as typeof arrayKeys[number]];
    const entry = list[Number(rawIndex)];
    entry.text[lang] = value;
  }
  return next;
}
const editReasonText: Record<(typeof EDIT_REASONS)[number], string> = {
  tone: "Tone", accuracy: "Accuracy", "too strong": "Claim is too strong", "missing risk": "Missing risk", citation: "Citation", "compliance wording": "Compliance wording", other: "Other",
};
const checklistText: Record<(typeof CHECKLIST)[number], string> = {
  figures_checked: "I checked the figures against the evidence packet",
  risks_adequate: "The material risks are adequately represented",
  wording_compliant: "The wording meets compliance requirements",
  shariah_context_correct: "The screening context is correct",
  disclosure_present: "The required disclosure is present",
  analyst_view_confirmed: "I confirm this analyst view",
};
const slotLabels: Record<string, string> = {
  title: "Draft title", summary: "Summary", business_overview: "Business overview",
  financial_highlights: "Financial highlights", strengths: "Strengths", risks: "Risks",
  valuation_discussion: "Valuation discussion", what_would_change_the_view: "What could change this view",
  open_questions_for_analyst: "Questions for the analyst", data_limitations: "Data limitations",
  analyst_view: "Analyst view reasons", plain_summary: "Short summary point",
};
function slotLabel(location: string) {
  const [key, rawIndex] = location.split(".");
  return `${slotLabels[key] ?? "Draft text"}${rawIndex === undefined ? "" : ` · ${Number(rawIndex) + 1}`}`;
}
function stateLabel(state: ResearchState) {
  const labels: Record<ResearchState, string> = {
    requested: "Requested", generated: "Generated", failed: "Generation failed",
    in_review: "In review", changes_requested: "Changes requested", edited: "Edited",
    approved: "Approved", rejected: "Rejected", published: "Published",
    updated: "Updated", withdrawn: "Withdrawn",
  };
  return labels[state];
}
function severityLabel(severity: "block" | "warn") {
  return severity === "block" ? "Blocking issue" : "Warning";
}
export function ResearchReview({ locale, draft, packet, activeAnalyst, saveAction, transitionAction, regenerateAction }: ResearchReviewProps) {
  const router = useRouter();
  const initial = draft.analyst_text ?? draft.ai_output;
  const baseModel = useMemo(() => modelOnly(initial), [initial]);
  const [edited, setEdited] = useState<ModelDraft | null>(() => baseModel);
  const [reasons, setReasons] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [guidance, setGuidance] = useState("");
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);
  const aiSlots = useMemo(() => slotsOf(draft.ai_output), [draft.ai_output]);
  const editedSlots = useMemo(() => slotsOf(edited), [edited]);
  const changed = editedSlots.filter((slot, index) => slot.ar !== aiSlots[index]?.ar || slot.en !== aiSlots[index]?.en);
  const isDirty = Boolean(edited && baseModel && JSON.stringify(edited) !== JSON.stringify(baseModel));
  const blocks = draft.validation_results.filter(issue => issue.severity === "block").length;
  const completeChecklist = CHECKLIST.every(key => checklist[key] === true);
  const canSave = activeAnalyst && (draft.state === "in_review" || draft.state === "changes_requested");
  const canApprove = activeAnalyst && draft.state === "in_review" && blocks === 0 && completeChecklist && !isDirty;
  const availableTransitions = TRANSITIONS[draft.state].filter(next => !["published", "updated", "withdrawn"].includes(next));
  async function run(action: ResearchAction, form: FormData, kind: string) {
    setPending(kind); setFeedback(""); setIsError(false);
    try {
      const result = await action(form); setFeedback(result.message || reviewText(locale, result.ok ? "Action completed." : "Action could not be completed.")); setIsError(!result.ok);
      if (result.ok) router.refresh();
    } catch { setFeedback(reviewText(locale, "Action could not be completed.")); setIsError(true); }
    finally { setPending(""); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!edited || !canSave) return;
    const form = new FormData(); form.set("draft_id", draft.id); form.set("text_hash", draft.text_hash ?? "");
    form.set("text", JSON.stringify(modelOnlyFromModel(edited)));
    reasons.forEach(reason => form.append("edit_reasons", reason));
    void run(saveAction, form, "save");
  }
  function transition(to: ResearchState) {
    const form = new FormData(); form.set("draft_id", draft.id); form.set("text_hash", draft.text_hash ?? "");
    form.set("to_state", to); form.set("checklist", JSON.stringify(checklist));
    void run(transitionAction, form, to);
  }
  return <ResearchFrame>
    <Heading locale={locale} eyebrow="ADMIN / EVIDENCE REVIEW" title="Inspect research draft" description="Review blocking checks, compare every edited statement with the model draft, and verify sources before deciding." />
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border bg-secondary/50 p-4"><div><p className="text-xs text-muted-foreground">{reviewText(locale, "Current state")}</p><p className="mt-1 font-medium">{reviewText(locale, stateLabel(draft.state))}</p></div><bdi className="font-mono text-xs text-muted-foreground" dir="ltr">{draft.id}</bdi></div>
    {(draft.failure_reason || draft.validation_results.length > 0) && <section aria-labelledby="validation-title" className="mb-6 border border-border bg-secondary/50 p-4 sm:p-5">
      <h2 id="validation-title" className="text-lg font-semibold">{reviewText(locale, "Validation and failure review")}</h2>
      {draft.failure_reason && <p className="mt-3 border-s-2 border-border ps-3 text-sm leading-6">{draft.failure_reason}</p>}
      <ul className="mt-3 space-y-2">{draft.validation_results.map((issue, i) => <li key={`${issue.check}-${i}`} className="flex flex-col gap-1 border-t border-border/70 pt-2 text-sm sm:flex-row sm:items-start sm:gap-3"><span className="shrink-0 font-semibold">{reviewText(locale, severityLabel(issue.severity))}</span><span className="font-mono text-xs" dir="ltr">{issue.check} · {issue.location}</span><span>{issue.message}</span></li>)}</ul>
    </section>}
    {!initial && <Message error>{reviewText(locale, "No generated text is available. Inspect the failure details before retrying.")}</Message>}
    {edited && <form onSubmit={save} className="space-y-6">
      <section className="border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">{reviewText(locale, "Field-by-field editorial review")}</h2><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "Arabic and English remain paired; evidence references are preserved.")}</p></div><span className="text-xs text-muted-foreground">{changed.length} {reviewText(locale, "changed fields")}</span></div>
        <div className="mt-5 space-y-5">{editedSlots.map((slot, index) => {
          const ai = aiSlots[index];
          const isChanged = slot.ar !== ai?.ar || slot.en !== ai?.en;
          return <fieldset key={slot.location} className={`border p-4 ${isChanged ? "border-primary/50 bg-primary/5" : "border-border"}`}>
            <legend className="px-2 text-sm font-medium">{reviewText(locale, slotLabel(slot.location))}</legend>
            {isChanged && <div className="mb-3 grid gap-2 border-s-2 border-primary ps-3 text-xs sm:grid-cols-2"><p><span className="font-medium">{reviewText(locale, "AI draft")}</span><span className="mt-1 block text-muted-foreground" dir="auto">{ai?.ar}</span><span className="mt-1 block text-muted-foreground" dir="auto">{ai?.en}</span></p><p><span className="font-medium">{reviewText(locale, "Edited version")}</span><span className="mt-1 block" dir="auto">{slot.ar}</span><span className="mt-1 block" dir="auto">{slot.en}</span></p></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {(["ar", "en"] as const).map(lang => <label key={lang} className="block text-sm"><span className="mb-1 block text-xs text-muted-foreground">{reviewText(locale, lang === "ar" ? "Arabic" : "English")}</span><textarea required value={slot[lang]} dir={lang === "ar" ? "rtl" : "ltr"} rows={Math.min(6, Math.max(2, Math.ceil(slot[lang].length / 78)))} onChange={e => setEdited(current => current ? setSlot(current, slot, lang, e.target.value) : current)} className="w-full border border-input bg-background p-3 leading-7" /></label>)}
            </div>
            {slot.cites && <p className="mt-3 text-xs text-muted-foreground">{reviewText(locale, "Cited evidence")}: <bdi dir="ltr" className="font-mono">{slot.cites.join(", ") || "—"}</bdi></p>}
            {slot.covers && <p className="mt-2 text-xs text-muted-foreground">{reviewText(locale, "Risk coverage")}: <bdi dir="ltr" className="font-mono">{slot.covers.join(", ")}</bdi></p>}
          </fieldset>;
        })}</div>
      </section>
      <section className="border border-border bg-card p-4 sm:p-6"><h2 className="text-lg font-semibold">{reviewText(locale, "Why was the draft edited?")}</h2><div className="mt-3 grid gap-1 sm:grid-cols-2">{EDIT_REASONS.map(reason => <label key={reason} className="flex min-h-11 items-center gap-3 border border-border px-3 text-sm"><input type="checkbox" checked={reasons.includes(reason)} onChange={e => setReasons(list => e.target.checked ? [...list, reason] : list.filter(value => value !== reason))} />{reviewText(locale, editReasonText[reason])}</label>)}</div></section>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><button disabled={!canSave || !!pending} className="min-h-11 bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{pending === "save" ? reviewText(locale, "Saving") : reviewText(locale, "Save editorial changes")}</button></div>
    </form>}
    <section className="mt-6 border border-border bg-card p-4 sm:p-6"><h2 className="text-lg font-semibold">{reviewText(locale, "Code-owned screening context")}</h2><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "Read-only results generated by the screening system; these are not editable draft prose.")}</p><pre dir="auto" className="mt-4 max-h-96 overflow-auto border border-border bg-background p-4 text-xs leading-6">{JSON.stringify(draft.ai_output?.shariah_context ?? [], null, 2)}</pre></section>
    <details className="group mt-4 border border-border bg-card"><summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">{reviewText(locale, "Evidence packet")}</summary><div className="border-t border-border p-4"><p className="text-xs text-muted-foreground">{reviewText(locale, "Packet hash")} <bdi dir="ltr" className="font-mono">{packet.packet_hash}</bdi></p><div className="mt-4 space-y-3">{packet.items.map(item => <article key={item.id} className="border border-border p-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><bdi dir="ltr" className="font-mono">{item.id}</bdi><span>{item.unavailable ? reviewText(locale, "Unavailable") : reviewText(locale, "Available")}</span></div><p className="mt-2 text-sm">{item.kind} · {item.unit}</p><p className="mt-1 break-all text-xs text-muted-foreground">{item.value === null ? (item.unavailable ?? "—") : String(item.value)} {item.unit}</p><p className="mt-2 text-xs text-muted-foreground">{item.source.label} · {item.date}</p>{item.source.url && <a href={item.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-sm underline underline-offset-4">{reviewText(locale, "Open source")}</a>}</article>)}</div></div></details>
    <section className="mt-6 border border-border bg-card p-4 sm:p-6"><h2 className="text-lg font-semibold">{reviewText(locale, "Analyst approval checklist")}</h2><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "All six answers are required to approve. Approval never publishes.")}</p><div className="mt-3 space-y-1">{CHECKLIST.map(key => <label key={key} className="flex min-h-11 items-center gap-3 border-b border-border py-2 text-sm"><input type="checkbox" checked={checklist[key] === true} onChange={e => setChecklist(current => ({ ...current, [key]: e.target.checked }))} />{reviewText(locale, checklistText[key])}</label>)}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={!canApprove || !!pending} onClick={() => transition("approved")} className="min-h-11 bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-40">{pending === "approved" ? reviewText(locale, "Approving") : reviewText(locale, "Approve draft")}</button>
        {availableTransitions.filter(next => next !== "approved").map(next => <button type="button" key={next} disabled={!activeAnalyst || !!pending} onClick={() => transition(next)} className="min-h-11 border border-border px-4 hover:bg-secondary disabled:opacity-40">{reviewText(locale, transitionLabel(next))}</button>)}
      </div>
    </section>
    <form onSubmit={e => { e.preventDefault(); const form = new FormData(); form.set("draft_id", draft.id); form.set("guidance", guidance); void run(regenerateAction, form, "regenerate"); }} className="mt-6 border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{reviewText(locale, "Regenerate after inspection")}</h2><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "Use only after reviewing why the prior output failed or needs correction.")}</p><label className="mt-4 block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, "Regeneration guidance")}</span><textarea value={guidance} onChange={e => setGuidance(e.target.value)} maxLength={1200} rows={3} className="w-full border border-input bg-background p-3" /></label><button disabled={!activeAnalyst || !guidance.trim() || !!pending} className="mt-3 min-h-11 border border-border px-4 hover:bg-secondary disabled:opacity-40">{pending === "regenerate" ? reviewText(locale, "Regenerating") : reviewText(locale, "Regenerate draft")}</button>
    </form>
    {feedback && <Message error={isError}>{feedback}</Message>}
  </ResearchFrame>;
}
function modelOnlyFromModel(draft: ModelDraft): ModelDraft {
  return {
    title: draft.title,
    summary: draft.summary,
    plain_summary: draft.plain_summary,
    business_overview: draft.business_overview,
    financial_highlights: draft.financial_highlights,
    strengths: draft.strengths,
    risks: draft.risks,
    valuation_discussion: draft.valuation_discussion,
    analyst_view: draft.analyst_view,
    what_would_change_the_view: draft.what_would_change_the_view,
    open_questions_for_analyst: draft.open_questions_for_analyst,
    data_limitations: draft.data_limitations,
  };
}
function transitionLabel(state: ResearchState) {
  const labels: Partial<Record<ResearchState, string>> = {
    generated: "Generated",
    failed: "Failed",
    in_review: "Move to review",
    changes_requested: "Request changes",
    edited: "Mark edited",
    rejected: "Reject draft",
  };
  return labels[state] ?? stateLabel(state);
}
