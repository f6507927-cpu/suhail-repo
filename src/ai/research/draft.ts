import { z } from "zod";
import { renderEnglish } from "../../engine/reasons/en";
import { renderArabicDraft } from "../../engine/reasons/ar";
import { stockCriterionLabel, stockReasonField } from "../../i18n/stock-labels";
import { formatNumber } from "../../lib/format";
import type { Bilingual, ResearchPacket } from "./contracts";

export const DRAFT_SCHEMA_VERSION = "research-draft-1";
export const bilingualSchema = z.strictObject({ ar: z.string().trim().min(1), en: z.string().trim().min(1) });
const shortLine = z.strictObject({ ar: z.string().trim().min(1).max(240), en: z.string().trim().min(1).max(240) });
const cited = z.strictObject({ text: bilingualSchema, cites: z.array(z.string().min(1)) });
/** D-183/D-213: no model slot for context, citations resolution, status or workflow. */
export const modelDraftSchema = z.strictObject({
  title: bilingualSchema,
  summary: bilingualSchema,
  plain_summary: z.tuple([shortLine, shortLine, shortLine]),
  business_overview: bilingualSchema,
  financial_highlights: z.array(cited),
  strengths: z.array(cited), risks: z.array(cited),
  valuation_discussion: bilingualSchema,
  analyst_view: z.strictObject({
    label: z.enum(["positive", "neutral", "cautious"]), reasons: z.array(cited).min(1),
  }),
  what_would_change_the_view: z.array(cited),
  open_questions_for_analyst: z.array(cited),
  data_limitations: z.array(cited.extend({ covers: z.array(z.string().min(1)).min(1) })),
});
export type ModelDraft = z.infer<typeof modelDraftSchema>;
export function screeningContext(packet: ResearchPacket) {
  // D-42: existing deterministic reason templates and approved labels, never a model explanation.
  return packet.screenings.map(run => ({
    methodology: run.methodology, label: run.label, version: run.version, status: run.status, data_as_of: run.data_as_of,
    reasons: run.reasons.map(reason => ({
      en: renderEnglish(reason),
      ar: renderArabicDraft({ ...reason, label: stockCriterionLabel({ criterion_label: reason.label }, "ar"),
        field: reason.field === null ? null : stockReasonField(reason.field, "ar") }),
    })),
  }));
}
export type ScreeningContext = ReturnType<typeof screeningContext>;
export interface ResearchDraft extends ModelDraft {
  draft_schema_version: string;
  packet_hash: string;
  shariah_context: ScreeningContext;
  citations: { item_id: string; source_id: string; url: string | null }[];
}
export function figureTokenIds(text: string) {
  return [...text.matchAll(/\{\{fig:([^{}]+)\}\}/g)].map(m => m[1]);
}
export function inlineCiteIds(text: string) {
  return [...text.matchAll(/\{\{cite:([^{}]+)\}\}/g)].map(m => m[1]);
}
export function renderFigures(text: string, packet: ResearchPacket, locale: "ar" | "en") {
  return text.replace(/\{\{fig:([^{}]+)\}\}/g, (_token, id: string) => {
    const item = packet.items.find(i => i.id === id);
    if (!item || item.unavailable || item.value === null) throw new Error(`Unavailable figure token: ${id}`);
    if (item.unit === "status" || item.unit === "text" || item.unit === "result") throw new Error(`Non-figure token: ${id}`);
    const value = typeof item.value === "number"
      ? `${formatNumber(item.value, locale, { maximumFractionDigits: 6 })}${item.unit.startsWith("percent") ? "%" : ""}`
      : String(item.value);
    // Unicode LRI/PDI works in plain text; HTML rendering is deliberately deferred.
    return `\u2066${value}\u2069`;
  });
}
/** Walk prose only. Context and resolved citations are code-owned and not model fields. */
export function proseFields(draft: ModelDraft): { location: string; text: Bilingual; cites: string[] }[] {
  const fields: { location: string; text: Bilingual; cites: string[] }[] = [];
  for (const key of ["title", "summary", "business_overview", "valuation_discussion"] as const)
    fields.push({ location: key, text: draft[key], cites: [] });
  draft.plain_summary.forEach((text, i) => fields.push({ location: `plain_summary.${i}`, text, cites: [] }));
  for (const key of ["financial_highlights", "strengths", "risks", "what_would_change_the_view", "open_questions_for_analyst", "data_limitations"] as const)
    draft[key].forEach((entry, i) => fields.push({ location: `${key}.${i}`, ...entry }));
  draft.analyst_view.reasons.forEach((entry, i) => fields.push({ location: `analyst_view.reasons.${i}`, ...entry }));
  return fields;
}
export function assembleDraft(value: unknown, packet: ResearchPacket): ResearchDraft {
  const model = modelDraftSchema.parse(value);
  const ids = new Set(proseFields(model).flatMap(f => [...f.cites,
    ...inlineCiteIds(f.text.ar), ...inlineCiteIds(f.text.en),
    ...figureTokenIds(f.text.ar), ...figureTokenIds(f.text.en)]));
  const citations = [...ids].sort().map(id => {
    const item = packet.items.find(i => i.id === id);
    if (!item) throw new Error(`Unknown citation: ${id}`);
    return { item_id: id, source_id: item.source.id, url: item.source.url };
  });
  return { ...model, draft_schema_version: DRAFT_SCHEMA_VERSION, packet_hash: packet.packet_hash,
    shariah_context: screeningContext(packet), citations };
}
