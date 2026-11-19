"use client";
import { useState, type FormEvent } from "react";
import type { ScopeSettings } from "@/lib/research/workflow";
import type { Locale } from "../accounts/types";
import { Heading, Message, ResearchFrame, reviewText, type ResearchAction } from "./research-ui";

type NullableFreshness = "max_packet_age_days" | "max_financial_age_days" | "price_move_threshold_percent" | "publication_age_days";
export interface ResearchSettingsProps {
  locale: Locale;
  settings: Omit<ScopeSettings, NullableFreshness> & Record<NullableFreshness, number | null> & { ai_research_publishing: boolean };
  saveAction: ResearchAction;
  gateAction: ResearchAction;
}
type NumericSetting = "monthly_token_budget" | "max_active_research_stocks" | "max_packet_age_days" | "max_financial_age_days" | "price_move_threshold_percent" | "publication_age_days";
const numericFields: { key: NumericSetting; label: string; step: string; min: string }[] = [
  { key: "monthly_token_budget", label: "Monthly token budget", step: "1", min: "0" },
  { key: "max_active_research_stocks", label: "Maximum active research stocks", step: "1", min: "0" },
  { key: "max_packet_age_days", label: "Maximum evidence packet age (days)", step: "1", min: "1" },
  { key: "max_financial_age_days", label: "Maximum financial data age (days)", step: "1", min: "1" },
  { key: "price_move_threshold_percent", label: "Price move threshold (%)", step: "0.1", min: "0.01" },
  { key: "publication_age_days", label: "Publication age limit (days)", step: "1", min: "1" },
];
export function ResearchSettings({ locale, settings, saveAction, gateAction }: ResearchSettingsProps) {
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const [sectors, setSectors] = useState(settings.allowed_sectors);
  async function run(action: ResearchAction, form: FormData, key: string) {
    setPending(key); setFeedback(""); setError(false);
    try { const result = await action(form); setFeedback(result.message || reviewText(locale, result.ok ? "Settings saved." : "Settings could not be saved. Try again.")); setError(!result.ok); }
    catch { setFeedback(reviewText(locale, "Settings could not be saved. Try again.")); setError(true); }
    finally { setPending(""); }
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); form.set("allowed_sectors", JSON.stringify(sectors)); void run(saveAction, form, "settings");
  }
  function gate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void run(gateAction, new FormData(event.currentTarget), "gate");
  }
  return <ResearchFrame>
    <Heading locale={locale} eyebrow="ADMIN / RESEARCH CONTROLS" title="Research settings" description="Set evidence freshness, operating limits, and permitted sectors. Publishing remains unavailable in P2." />
    <form onSubmit={save} className="divide-y divide-border border border-border bg-card">
      <section className="p-4 sm:p-6"><h2 className="text-lg font-semibold">{reviewText(locale, "Research scope and evidence limits")}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{numericFields.map(field => { const value = settings[field.key]; const nullable = value === null; return <label key={field.key} className="block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, field.label)}</span><input type="number" name={field.key} required={!nullable} min={field.min} step={field.step} defaultValue={value ?? ""} className="w-full border border-input bg-background px-3" /></label>; })}</div>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{reviewText(locale, "Allowed sectors and limits")}</h3><p className="mt-1 text-sm text-muted-foreground">{reviewText(locale, "A blank limit allows the configured active-stock cap to apply.")}</p></div><button type="button" onClick={() => setSectors(list => [...list, { sector: "", limit: null }])} className="min-h-11 border border-border px-3 text-sm hover:bg-secondary">{reviewText(locale, "Add sector")}</button></div>
        <div className="mt-3 space-y-3">{sectors.map((sector, index) => <div key={index} className="grid gap-3 border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_auto] sm:items-end"><label className="block text-sm"><span className="mb-1 block text-xs text-muted-foreground">{reviewText(locale, "Sector name")}</span><input value={sector.sector} onChange={e => setSectors(list => list.map((value, i) => i === index ? { ...value, sector: e.target.value } : value))} className="w-full border border-input bg-background px-3" /></label><label className="block text-sm"><span className="mb-1 block text-xs text-muted-foreground">{reviewText(locale, "Sector stock limit")}</span><input type="number" min="1" step="1" value={sector.limit ?? ""} onChange={e => setSectors(list => list.map((value, i) => i === index ? { ...value, limit: e.target.value ? Number(e.target.value) : null } : value))} placeholder={reviewText(locale, "No separate limit")} className="w-full border border-input bg-background px-3" /></label><button type="button" onClick={() => setSectors(list => list.filter((_, i) => i !== index))} className="min-h-11 border border-border px-3 text-sm hover:bg-secondary">{reviewText(locale, "Remove")}</button></div>)}</div>
      </section>
      <section className="p-4 sm:p-6"><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="ai_research_publishing" value="true" checked={false} disabled aria-describedby="p2-publishing-note" /><span><span className="font-medium">{reviewText(locale, "Enable AI research publishing")}</span><span id="p2-publishing-note" className="mt-1 block text-muted-foreground">{reviewText(locale, "Unavailable in P2. Research drafts require analyst review and approval; no publication action is available.")}</span></span></label><input type="hidden" name="ai_research_publishing" value="false" /></section>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><p className="text-sm text-muted-foreground">{reviewText(locale, "Changes apply to future research requests.")}</p><button disabled={!!pending} className="min-h-11 bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50">{pending === "settings" ? reviewText(locale, "Saving") : reviewText(locale, "Save research settings")}</button></div>
    </form>
    <form onSubmit={gate} className="mt-6 border border-border bg-secondary/50 p-4 sm:p-6"><h2 className="text-lg font-semibold">{reviewText(locale, "Publication gate")}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{reviewText(locale, "P2 does not publish AI research. Enabling any future gate requires documented founder approval and a legal reference.")}</p><input type="hidden" name="ai_research_publishing" value="false" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, "Founder decision ID")}</span><input name="decision" pattern="D-[0-9]+" placeholder="D-000" className="w-full border border-input bg-background px-3" /></label><label className="block text-sm"><span className="mb-2 block text-muted-foreground">{reviewText(locale, "Lawyer reference")}</span><input name="lawyer_reference" className="w-full border border-input bg-background px-3" /></label></div><label className="mt-4 flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="enabled" value="true" />{reviewText(locale, "Enable publication gate")}</label><p className="mt-2 text-xs text-muted-foreground">{reviewText(locale, "The gate is off by default. This setting cannot publish drafts.")}</p><button disabled={!!pending} className="mt-4 min-h-11 border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50">{pending === "gate" ? reviewText(locale, "Saving") : reviewText(locale, "Save gate decision")}</button></form>
    {feedback && <Message error={error}>{feedback}</Message>}
  </ResearchFrame>;
}
