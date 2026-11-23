"use client";
import { useEffect, useState } from "react";
import { formatCalendarDate } from "@/lib/format";
import type { PublicStockResearch } from "@/stock/research-public-types";
import { Num } from "../foundation/Num";
import { reviewText, type Locale } from "../accounts/types";
import { Bilingual, LanguageNotice } from "./StockVerdictParts";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";
import styles from "./StockVerdict.module.css";

const ui = {
  title: "Stock research",
  details: "Analysis and evidence",
  hidden: "The analyst’s view is not available for the current screening result.",
  approval: "Research approved",
  data: "Research data as of",
  changes: "Why this changed",
  outdated: "What may be out of date",
  evidence: "Evidence cited",
  methodologies: "Methodology results referenced",
  disclosure: "AI-assisted research, reviewed by the named analyst.",
  conflict: "Conflict disclosures are not recorded for this research.",
  thesis: "Analyst’s thesis",
  risks: "Risks",
  valuation: "Valuation context",
} as const;
const changeNotes = {
  new_filing: "New filing evidence is available.",
  identity_change: "The company or coverage record changed.",
  derived_change: "The financial evidence changed.",
  status_change: "A stored screening result changed.",
  status_changed: "A stored screening result changed.",
  price_move: "The stored price moved beyond the configured threshold.",
  price_moved: "The stored price moved beyond the configured threshold.",
  age: "The research reached its configured review age.",
  aged: "The research reached its configured review age.",
} as const;

function ResearchCopy({ locale, text }: { locale: Locale; text: typeof ui[keyof typeof ui] | typeof changeNotes[keyof typeof changeNotes] }) {
  const displayed = reviewText(locale, text);
  return <bdi lang={displayed === text ? "en" : locale} dir="auto">{displayed}</bdi>;
}

function ResearchDate({ locale, value }: { locale: Locale; value: string }) {
  const day = value.slice(0, 10);
  return <time dateTime={day}><Num>{formatCalendarDate(day, locale)}</Num></time>;
}

function ResearchChanges({ locale, date, codes, label }: { locale: Locale; date: string | null;
  codes: (keyof typeof changeNotes)[]; label: typeof ui.changes | typeof ui.outdated }) {
  if (!date || !codes.length) return null;
  return <aside><h3><ResearchCopy locale={locale} text={label} /></h3>
    <ResearchDate value={date} locale={locale} />
    <ul>{[...new Set(codes.map(code => changeNotes[code]))].map(text => <li key={text}><ResearchCopy locale={locale} text={text} /></li>)}</ul>
  </aside>;
}

export function StockResearchContent({ locale, data, evidence, contextLine }: { locale: Locale; data: PublicStockResearch;
  evidence: Record<string, string>; contextLine: string }) {
  const bio = locale === "ar" ? data.bio_ar ?? data.bio_en : data.bio_en ?? data.bio_ar;
  return <section id="stock-research" className={`${styles.section} space-y-3 break-words`} aria-labelledby="stock-ai-research-title">
    <h2 id="stock-ai-research-title" className="text-xl font-semibold"><ResearchCopy locale={locale} text={ui.title} /></h2>
    <ul data-research-summary className="space-y-1">{data.plain_summary.map((line, index) =>
      <li key={index}><Bilingual locale={locale} arabic={line.ar} english={line.en} formatFigures /></li>)}</ul>
    <LanguageNotice locale={locale} needed={locale === "ar" && reviewText(locale, ui.disclosure) === ui.disclosure} sections={[ui.title]} />
    <p><ResearchCopy locale={locale} text={ui.disclosure} /></p>
    <p><bdi dir="auto">{contextLine}</bdi></p>
    <ResearchChanges locale={locale} date={data.updated_at} codes={data.update_codes} label={ui.changes} />
    <ResearchChanges locale={locale} date={data.outdated_at} codes={data.outdated_codes} label={ui.outdated} />
    <p><Bilingual locale={locale} arabic={data.name_ar} english={data.name_en} />
      {(data.title_ar || data.title_en) && <> · <Bilingual locale={locale} arabic={data.title_ar} english={data.title_en} /></>}
      {data.credentials && <> · <bdi dir="auto">{data.credentials}</bdi></>}
    </p>
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <div><dt><ResearchCopy locale={locale} text={ui.approval} /></dt><dd><ResearchDate value={data.approval_at} locale={locale} /></dd></div>
      <div><dt><ResearchCopy locale={locale} text={ui.data} /></dt><dd><ResearchDate value={data.data_as_of} locale={locale} /></dd></div>
    </dl>
    {!data.analyst_view && <p><ResearchCopy locale={locale} text={ui.hidden} /></p>}
    <details>
      <summary className="min-h-11"><ResearchCopy locale={locale} text={ui.details} /></summary>
      {bio && <p><Bilingual locale={locale} arabic={data.bio_ar} english={data.bio_en} /></p>}
      {data.analyst_view && <>
        <h3><ResearchCopy locale={locale} text={ui.thesis} /></h3>
        {data.analyst_view.thesis.map((line, index) => <p key={index}><Bilingual locale={locale} arabic={line.ar} english={line.en} formatFigures /></p>)}
        <h3><ResearchCopy locale={locale} text={ui.risks} /></h3>
        <ul>{data.analyst_view.risks.map((line, index) => <li key={index}><Bilingual locale={locale} arabic={line.ar} english={line.en} formatFigures /></li>)}</ul>
        <h3><ResearchCopy locale={locale} text={ui.valuation} /></h3>
        <p><Bilingual locale={locale} arabic={data.analyst_view.valuation.ar} english={data.analyst_view.valuation.en} formatFigures /></p>
        <p><ResearchCopy locale={locale} text={ui.conflict} /></p>
        {data.analyst_view.evidence.map((line, index) => <p key={index}><Bilingual locale={locale} arabic={line.ar} english={line.en} formatFigures /></p>)}
      </>}
      <h3><ResearchCopy locale={locale} text={ui.methodologies} /></h3>
      <ul>{data.methodologies.map(method => <li key={method.slug}><bdi dir="auto">{method.label}</bdi>{": "}
        <bdi>{(locale === "ar" ? ar : en).status[method.status as keyof typeof en.status]}</bdi></li>)}</ul>
      <h3><ResearchCopy locale={locale} text={ui.evidence} /></h3>
      <ul>{data.citations.map(source => {
        const anchor = evidence[source.source_id] ?? "stock-sources-title";
        return <li key={source.source_id}><a href={`#${anchor}`} className="underline" onClick={() => {
          let details = document.getElementById(anchor)?.closest("details");
          while (details) { details.open = true; details = details.parentElement?.closest("details") ?? null; }
        }}><bdi dir="auto">{source.label}</bdi></a></li>;
      })}</ul>
    </details>
  </section>;
}

export function StockResearch({ locale, slug, evidence, contextLine }: { locale: Locale; slug: string; evidence: Record<string, string>; contextLine: string }) {
  const [data, setData] = useState<{ slug: string; research: PublicStockResearch } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/stock-research/${encodeURIComponent(slug)}`, { credentials: "omit", cache: "no-store", signal: controller.signal })
      .then(async response => response.ok ? await response.json() as PublicStockResearch : null)
      .then(research => { if (!controller.signal.aborted) setData(research ? { slug, research } : null); })
      .catch(() => { if (!controller.signal.aborted) setData(null); });
    return () => controller.abort();
  }, [slug]);
  return data?.slug === slug ? <StockResearchContent locale={locale} data={data.research} evidence={evidence} contextLine={contextLine} /> : null;
}
