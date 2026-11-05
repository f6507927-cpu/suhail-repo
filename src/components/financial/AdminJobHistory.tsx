"use client";
import type { FinancialAdminData } from "@/lib/financial/contracts";
import { reviewText, type Locale } from "@/components/accounts/types";
import { formatDate, formatNumber } from "@/lib/format";
import { uiNineText } from "@/i18n/admin-presentation";
type Job = FinancialAdminData["jobs"][number];
export function AdminJobHistory({ jobs, locale, canEdit, pending, onResume, onRetry }: {
  jobs: Job[]; locale: Locale; canEdit: boolean; pending: boolean; onResume: (job: Job)=>void; onRetry: (securityId:string)=>void;
}) {
  return <div className="space-y-4">{jobs.map(job => {
    const errors = Array.isArray(job.errors) ? job.errors : [];
    const count = Array.isArray(job.cursor?.ids) ? job.cursor.ids.length : null;
    const name = job.job_name === "screen-universe" ? uiNineText(locale,"Screen all") : job.job_name === "ingest-sec" ? uiNineText(locale,"Ingest all") : reviewText(locale,"Job");
    const status = { running:"Running",completed:"Completed",failed:"Failed",pending:"Pending" }[job.status] ?? job.status;
    return <article key={job.id} className="min-w-0 space-y-3 border border-border p-4" data-job-history>
      <h3 className="text-sm font-medium">{name} · {uiNineText(locale,"{count} stocks",{count:count===null?"—":formatNumber(count,locale)})} · {uiNineText(locale,"{count} failed",{count:job.counts?.failed??"—"})}</h3>
      <p className="text-sm">{reviewText(locale,status)} · {formatDate(job.started_at,locale,{dateStyle:"medium",timeStyle:"short"})}</p>
      {errors.length>0 && <ul className="space-y-2 text-sm">{errors.map((error,index)=><li key={index}>
        {String(error.message??error.error??reviewText(locale,"Failed"))}
        {typeof error.securityId==="string" && canEdit && <button type="button" className="ms-2 min-h-11 border border-border px-3" disabled={pending} onClick={()=>onRetry(error.securityId as string)}>{reviewText(locale,"Retry")}</button>}
      </li>)}</ul>}
      {canEdit && <button type="button" className="min-h-11 border border-border px-3 text-sm" disabled={pending} onClick={()=>onResume(job)}>{reviewText(locale,"Resume")}</button>}
      <details><summary className="cursor-pointer text-sm">{uiNineText(locale,"Details")}</summary>
        <p className="my-2 break-all font-mono text-[13px]" dir="ltr">{job.job_name} · {job.id}</p>
        <p className="text-[13px]">{reviewText(locale,"Finished")}: {formatDate(job.finished_at,locale,{dateStyle:"medium",timeStyle:"short"})}</p>
        <pre dir="ltr" className="mt-3 whitespace-pre-wrap break-all text-[13px]">{JSON.stringify({counts:job.counts,cursor:job.cursor},null,2)}</pre>
      </details>
    </article>;
  })}</div>;
}
