"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STALE_REASONS, type StaleReason } from "@/ai/research/staleness";
import { localePath } from "@/lib/auth/paths";
import type { QueueRow } from "@/lib/research/stale-store";
import type { Locale } from "../accounts/types";
import { Heading, Message, ResearchFrame, reviewText, type ResearchAction } from "./research-ui";

const labels: Record<StaleReason, string> = {
  new_filing: "New filing", status_changed: "Screening changed", price_moved: "Price moved", aged: "Approval aged",
};
export function ResearchQueue({ locale, rows, activeAnalyst, requestAction }: {
  locale: Locale; rows: QueueRow[]; activeAnalyst: boolean; requestAction: ResearchAction;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; message: string }>();
  async function request(id: string) {
    if (lock.current) return;
    lock.current = true; setPending(id); setFeedback(undefined);
    const form = new FormData();
    form.set("draft_id", id);
    try {
      const result = await requestAction(form);
      setFeedback({ id, ok: result.ok, message: result.message ?? reviewText(locale, result.ok
        ? "Research request submitted." : "Action could not be completed.") });
      if (result.ok) router.refresh();
    } catch { setFeedback({ id, ok: false, message: reviewText(locale, "Action could not be completed.") }); }
    finally { lock.current = false; setPending(""); }
  }
  return <ResearchFrame>
    <Heading locale={locale} eyebrow="ADMIN / RESEARCH WORKFLOW" title="Research refresh queue"
      description="See what changed since approval and request a refresh only when needed." />
    <a href={localePath(locale, "/admin/research")} className="mb-5 inline-flex min-h-11 items-center text-sm underline">{reviewText(locale, "Research drafts")}</a>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STALE_REASONS.map(reason => <div key={reason} className="border border-border bg-card p-3">
        <dt className="text-sm text-muted-foreground">{reviewText(locale, labels[reason])}</dt>
        <dd className="mt-1 font-mono text-xl"><bdi dir="ltr">{rows.filter(row => row.reasons.includes(reason)).length}</bdi></dd>
      </div>)}
    </dl>
    {!activeAnalyst && <Message>{reviewText(locale, "An active analyst profile is required to request a refresh.")}</Message>}
    <div className="mt-5 space-y-3">
      {rows.map(row => <article key={row.id} className="border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold"><bdi dir="ltr">{row.ticker}</bdi></h2>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs">
              {row.reasons.map(reason => <li key={reason} className="border border-border px-2 py-1">{reviewText(locale, labels[reason])}</li>)}
            </ul>
            {row.review_required && <p className="mt-2 text-sm text-muted-foreground">{reviewText(locale, "Analyst view needs review")}</p>}
          </div>
          <button type="button" disabled={!activeAnalyst || !!pending || row.refresh_in_progress}
            onClick={() => void request(row.id)} className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {reviewText(locale, row.refresh_in_progress ? "Refresh in progress" : pending === row.id ? "Submitting" : "Request refresh")}
          </button>
        </div>
        <a href={localePath(locale, `/admin/research/${encodeURIComponent(row.id)}`)} className="mt-2 inline-flex min-h-11 items-center text-sm underline">{reviewText(locale, "Inspect draft")}</a>
        {feedback?.id === row.id && <Message error={!feedback.ok}>{feedback.message}</Message>}
      </article>)}
      {!rows.length && <Message>{reviewText(locale, "No outdated research drafts.")}</Message>}
    </div>
  </ResearchFrame>;
}
