"use client";
import { useEffect, useRef } from "react";
import type { Locale } from "@/components/accounts/types";
import { uiNineText } from "@/i18n/admin-presentation";
export function AdminRunConfirmation({ locale, title, count, versions, onCancel, onRun }: {
  locale: Locale; title: string; count: number; versions?: string[]; onCancel: () => void; onRun: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); opener?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="admin-run-confirmation" onCancel={onCancel}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border border-border bg-card p-5 text-foreground backdrop:bg-black/50">
    <h2 id="admin-run-confirmation" className="text-lg font-semibold">{uiNineText(locale, "Confirm run")} · {title}</h2>
    <p className="mt-4 text-sm">{uiNineText(locale, "This will cover {count} stocks.", { count })}</p>
    {versions?.map((version,index) => <p key={`${index}-${version}`} className="mt-2 break-words text-sm">{uiNineText(locale, "Version: {version}", {version})}</p>)}
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" className="min-h-11 border border-border px-4" onClick={onCancel}>{uiNineText(locale, "Cancel")}</button>
      <button type="button" className="min-h-11 bg-primary px-4 text-primary-foreground" onClick={onRun}>{uiNineText(locale, "Run")}</button>
    </div>
  </dialog>;
}
