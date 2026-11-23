"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import type { Locale } from "../accounts/types";
import { WITHDRAWAL_REASONS, type PublicationKind } from "@/stock/research-public-types";
import { Message, reviewText, type ResearchAction } from "./research-ui";

const labels = { published: "Publish approved research", updated: "Publish approved refresh", withdrawn: "Withdraw publication" } as const;
const reasons = { evidence_corrected: "Evidence was corrected", no_longer_current: "Research is no longer current",
  editorial_withdrawal: "Editorial withdrawal" } as const;

export function PublicationControls({ locale, draftId, enabled, kind, action }: { locale: Locale; draftId: string;
  enabled: boolean; kind: PublicationKind; action: ResearchAction }) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<ResearchAction>>>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !enabled) return;
    lock.current = true;
    setPending(true);
    setResult(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const response = await action(form);
      setResult(response);
      if (response.ok) router.refresh();
    } catch { setResult({ ok: false }); }
    finally { lock.current = false; setPending(false); }
  }
  return <details className="mt-4 border border-border bg-card">
    <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">{reviewText(locale, "Research publication")}</summary>
    <form className="space-y-3 p-4" onSubmit={submit}>
      <input type="hidden" name="draft_id" value={draftId} /><input type="hidden" name="kind" value={kind} />
      {!enabled && <p>{reviewText(locale, "Publishing remains off pending Arabic copy and Shariah review (O-13 and O-11).")}</p>}
      {kind === "withdrawn" && <label className="block">{reviewText(locale, "Withdrawal reason")}
        <select name="reason" required defaultValue="" disabled={!enabled} className="mt-2 block w-full border border-input bg-background p-2">
          <option value="" disabled>{reviewText(locale, "Choose a withdrawal reason")}</option>
          {WITHDRAWAL_REASONS.map(reason => <option key={reason} value={reason}>{reviewText(locale, reasons[reason])}</option>)}
        </select>
      </label>}
      <button disabled={!enabled || pending} className="min-h-11 border border-border px-4 disabled:opacity-50">{reviewText(locale, labels[kind])}</button>
      {result && <Message error={!result.ok}>{result.message ?? reviewText(locale, result.ok ? "Action completed." : "Action could not be completed.")}</Message>}
    </form>
  </details>;
}
