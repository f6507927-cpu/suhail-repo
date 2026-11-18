"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RESEARCH_STATES } from "@/lib/research/contracts";
import type { Locale } from "../accounts/types";
import { localePath } from "@/lib/auth/paths";
import { Heading, Message, ResearchFrame, reviewText, type ResearchAction } from "./research-ui";

export interface ResearchListProps {
  locale: Locale;
  rows: { id: string; ticker: string; state: string; blocks: number }[];
  securities: { id: string; ticker: string }[];
  requestAction: ResearchAction;
  settingsHref: string | null;
}
function researchStateLabel(state: string) {
  const labels: Record<string, string> = {
    requested: "Requested", generated: "Generated", failed: "Generation failed",
    in_review: "In review", changes_requested: "Changes requested", edited: "Edited",
    approved: "Approved", rejected: "Rejected", published: "Published",
    updated: "Updated", withdrawn: "Withdrawn",
  };
  return labels[state] ?? "Research draft";
}

export function ResearchList({ locale, rows, securities, requestAction, settingsHref }: ResearchListProps) {
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const formElement = event.currentTarget;
    lock.current = true; setPending(true); setFeedback(""); setFailed(false);
    try {
      const result = await requestAction(new FormData(formElement));
      setFeedback(result.message || reviewText(locale, result.ok ? "Research request submitted." : "Request could not be submitted. Try again."));
      setFailed(!result.ok);
      if (result.ok) { formElement.reset(); router.refresh(); }
    } catch {
      setFeedback(reviewText(locale, "Request could not be submitted. Try again.")); setFailed(true);
    } finally { lock.current = false; setPending(false); }
  }
  return <ResearchFrame>
    <Heading locale={locale} eyebrow="ADMIN / RESEARCH WORKFLOW" title="Research drafts" description="Request an evidence packet, then inspect failures and validation before review." />
    <aside className="mb-5 border-s-2 border-border bg-secondary/50 px-4 py-3 text-sm leading-6">{reviewText(locale, "Research prompts will not go live until O13 is approved.")}</aside>
    <form onSubmit={submit} className="grid gap-4 border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-6">
      <label className="block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, "Security")}</span><select name="security_id" required defaultValue="" className="w-full border border-input bg-background px-3"><option value="" disabled>{reviewText(locale, "Choose a covered security")}</option>{securities.map(item => <option key={item.id} value={item.id}>{item.ticker}</option>)}</select></label>
      <label className="block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, "Optional guidance")}</span><input name="guidance" maxLength={1200} className="w-full border border-input bg-background px-3" placeholder={reviewText(locale, "Focus for the analyst")} /></label>
      <button disabled={pending || securities.length === 0} className="min-h-11 bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{pending ? reviewText(locale, "Submitting") : reviewText(locale, "Request research")}</button>
      {feedback && <div className="sm:col-span-3"><Message error={failed}>{feedback}</Message></div>}
    </form>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">{reviewText(locale, "Draft queue")}</h2><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "Blocking checks remain visible until resolved.")}</p></div>{settingsHref && <a href={localePath(locale, settingsHref)} className="min-h-11 border border-border px-4 py-2 text-sm hover:bg-secondary">{reviewText(locale, "Research settings")}</a>}</div>
    <div className="mt-4 space-y-3">
      <label className="block text-sm">{reviewText(locale, "Filter by state")}
        <select value={stateFilter} onChange={event => setStateFilter(event.target.value)} className="mt-2 block w-full border border-input bg-background">
          <option value="">{reviewText(locale, "All states")}</option>
          {RESEARCH_STATES.filter(state => !["published", "updated", "withdrawn"].includes(state)).map(state =>
            <option key={state} value={state}>{reviewText(locale, researchStateLabel(state))}</option>)}
        </select>
      </label>
      {rows.filter(row => !stateFilter || row.state === stateFilter).map(row => <article key={row.id} className="flex flex-col gap-4 border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><bdi dir="ltr" className="font-mono text-lg font-semibold">{row.ticker}</bdi><span className="border border-border px-2 py-1 text-xs">{reviewText(locale, researchStateLabel(row.state))}</span><span className="text-sm text-muted-foreground">{row.blocks} {reviewText(locale, row.blocks === 1 ? "blocking issue" : "blocking issues")}</span></div>
        <a href={localePath(locale, `/admin/research/${encodeURIComponent(row.id)}`)} className="inline-flex min-h-11 items-center justify-center bg-secondary px-4 text-sm font-medium hover:bg-muted">{reviewText(locale, "Inspect draft")}</a>
      </article>)}
      {rows.length === 0 && <div className="border border-dashed border-border bg-card px-5 py-12 text-center"><p className="font-medium">{reviewText(locale, "No research drafts yet")}</p><p className="mt-2 text-sm text-muted-foreground">{reviewText(locale, "Choose a covered security above to begin an evidence-led review.")}</p></div>}
    </div>
  </ResearchFrame>;
}
