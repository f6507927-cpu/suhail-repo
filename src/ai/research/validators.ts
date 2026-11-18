import ar from "../../i18n/messages/ar.json";
import en from "../../i18n/messages/en.json";
import { canonicalize } from "../../engine/canonical";
import type { JsonValue } from "../../engine/types";
import { BANNED_AR, BANNED_EN, BANNED_PHRASES_VERSION, BANNED_AR_VERSION, BANNED_EN_VERSION, containsPhrase, normalizeArabic } from "./banned-phrases";
import { VALIDATOR_VERSION, type ResearchPacket, type ValidationIssue } from "./contracts";
import { DRAFT_SCHEMA_VERSION, figureTokenIds, inlineCiteIds, modelDraftSchema, proseFields, renderFigures, screeningContext, type ResearchDraft } from "./draft";
import { isGrounded, packetDates, renderedClaims } from "./grounding";
import { packetHash } from "./packet";
import { hasEmail, hasPhone } from "./privacy";
import { STYLE_GUIDE } from "./style-guide";

export interface ValidationSettings {
  now: string;
  max_packet_age_days: number;
  max_financial_age_days: number;
  known_issuers: string[];
  latest_packet?: ResearchPacket;
  guidance?: string;
  stage?: "draft" | "publish";
  disclosure_resolved?: boolean;
  context_line_resolved?: boolean;
}
function same(a: unknown, b: unknown) {
  const canon = (v: unknown) => canonicalize(JSON.parse(JSON.stringify(v)) as JsonValue);
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}
export function validateGuidance(guidance: string): ValidationIssue[] {
  return guidance.length > 2000 || hasEmail(guidance) || hasPhone(guidance)
    ? [{ check: "personal_data", severity: "block", message: "Guidance contains personal contact data or exceeds 2000 characters", location: "guidance" }]
    : [];
}
export function validateResearchDraft(value: unknown, packet: ResearchPacket, settings: ValidationSettings): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (check: string, message: string, location: string, severity: "block" | "warn" = "block") =>
    issues.push({ check, severity, message, location });
  if (!Number.isFinite(Date.parse(settings.now)) || !Number.isFinite(settings.max_packet_age_days) || settings.max_packet_age_days <= 0
    || !Number.isFinite(settings.max_financial_age_days) || settings.max_financial_age_days <= 0)
    throw new Error("Explicit valid freshness settings are required");
  if (settings.guidance) issues.push(...validateGuidance(settings.guidance));
  const draft = value as ResearchDraft;
  if (!draft || typeof draft !== "object") return [{ check: "schema", severity: "block", message: "Draft must be an object", location: "draft" }];
  const { draft_schema_version, packet_hash, shariah_context, citations, ...model } = draft;
  const parsed = modelDraftSchema.safeParse(model);
  if (!parsed.success) {
    for (const error of parsed.error.issues) add("schema", error.message, error.path.join("."));
    return issues;
  }
  if (draft_schema_version !== DRAFT_SCHEMA_VERSION) add("schema", "Unsupported draft schema version", "draft_schema_version");
  if (packet_hash !== packet.packet_hash || packet.packet_hash !== packetHash(packet)) add("packet_integrity", "Packet hash mismatch", "packet_hash");
  if (!same(shariah_context ?? null, screeningContext(packet))) add("status", "Code-owned screening context changed", "shariah_context");
  const byId = new Map(packet.items.map(i => [i.id, i]));
  const allCites = new Set<string>();
  const fields = proseFields(parsed.data);
  for (const field of fields) {
    const tokenSets: string[][] = [], numericSets: string[][] = [];
    for (const locale of ["ar", "en"] as const) {
      const location = `${field.location}.${locale}`, text = field.text[locale];
      if (!(locale === "ar" ? /\p{Script=Arabic}/u : /[a-z]/iu).test(text))
        add("languages", "Required language is absent", location);
      const tokens = figureTokenIds(text), inline = inlineCiteIds(text);
      const referenced = [...new Set([...field.cites, ...tokens, ...inline])];
      referenced.forEach(id => allCites.add(id));
      for (const id of referenced) if (!byId.has(id)) add("citations", `Unknown packet citation: ${id}`, location);
      tokenSets.push([...new Set(tokens)].sort());
      let rendered: string;
      try { rendered = renderFigures(text, packet, locale); }
      catch (error) { add("grounding", (error as Error).message, location); continue; }
      if (/\{\{(?:fig|cite):/.test(rendered.replace(/\{\{cite:[^{}]+\}\}/g, ""))) add("grounding", "Malformed evidence token", location);
      const prose = rendered.replace(/\{\{cite:[^{}]+\}\}/g, "");
      const claimsInField: string[] = [];
      // D-190: only explicit block cites are shared. An inline cite/token in a
      // different sentence can never ground this sentence's amounts or dates.
      for (const sentence of text.split(/(?<=[.!?؟؛])(?:\s+|$)/u)) {
        const sentenceIds = [...field.cites, ...inlineCiteIds(sentence), ...figureTokenIds(sentence)];
        const citedItems = sentenceIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
        const dates = packetDates(packet, citedItems);
        const { claims } = renderedClaims(sentence, packet, locale);
        claimsInField.push(...claims.map(c => `${c.kind}:${c.value}`));
        for (const claim of claims)
          if (!isGrounded(claim, citedItems, dates)) add("grounding", `Unsupported ${claim.kind}: ${claim.raw}`, location);
        if (claims.length && !citedItems.length)
          add("citations", "Figure-bearing sentence has no valid citation", location);
      }
      numericSets.push([...new Set(claimsInField)].sort());
      for (const entry of locale === "ar" ? BANNED_AR : BANNED_EN)
        if (containsPhrase(prose, entry.phrase)) add("banned_phrase", entry.reason, location, entry.severity);
      for (const name of settings.known_issuers.filter(n => n.length >= 4))
        if (name.toLowerCase() !== packet.security.name.toLowerCase() && name.toLowerCase() !== packet.security.ticker.toLowerCase()
          && containsPhrase(prose, name)) add("other_issuer", `Other issuer name: ${name}`, location);
      // D-183: scope status assertions to their sentence and named methodology.
      for (const sentence of prose.split(/(?<=[.!?؟؛])(?:\s+|$)/u)) {
        const named = packet.screenings.filter(s => containsPhrase(sentence, s.label));
        const applicable = named.length ? named : packet.screenings;
        // Finite approved labels, not whole-namespace consumption (Arabic copy audit).
        const labels = [
          ["passes_selected_methodology", locale === "ar" ? ar.status.passes_selected_methodology : en.status.passes_selected_methodology],
          ["fails_selected_methodology", locale === "ar" ? ar.status.fails_selected_methodology : en.status.fails_selected_methodology],
          ["requires_review", locale === "ar" ? ar.status.requires_review : en.status.requires_review],
          ["insufficient_data", locale === "ar" ? ar.status.insufficient_data : en.status.insufficient_data],
        ].sort((a, b) => b[1].length - a[1].length);
        let remaining = normalizeArabic(sentence);
        for (const [status, label] of labels) {
          if (!containsPhrase(remaining, label)) continue;
          if (!applicable.length || applicable.some(s => s.status !== status))
            add("status", "Status wording disagrees with the stored methodology result", location);
          // Arabic "Likely Non-Compliant" contains the pass label; longest match wins.
          remaining = remaining.replace(new RegExp(normalizeArabic(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), "");
        }
        for (const status of ["passes_selected_methodology", "requires_review", "fails_selected_methodology", "insufficient_data"])
          if (sentence.includes(status) && (!applicable.length || applicable.some(s => s.status !== status)))
            add("status", "Raw status disagrees with stored results", location);
      }
    }
    if (tokenSets.length === 2 && !same(tokenSets[0], tokenSets[1])) add("languages", "Figure tokens differ between languages", field.location);
    if (numericSets.length === 2 && !same(numericSets[0], numericSets[1])) add("languages", "Rendered figures differ between languages", field.location);
  }
  const resolved = [...allCites].filter(id => byId.has(id)).sort().map(id => {
    const item = byId.get(id)!;
    return { item_id: id, source_id: item.source.id, url: item.source.url };
  });
  if (!same(citations ?? null, resolved)) add("citations", "Resolved citations differ from cited packet items", "citations");
  if (!packet.security.covered || !packet.security.in_universe) add("coverage", "Stock must be covered and in the universe", "security");
  const age = (date: string) => (Date.parse(settings.now) - Date.parse(date)) / 86_400_000;
  const stale: string[] = [];
  if (age(packet.built_at) < 0 || age(packet.built_at) > settings.max_packet_age_days) stale.push("stale:packet");
  if (!packet.periods.length || age(packet.periods[0].period_end) > settings.max_financial_age_days) stale.push("stale:financial");
  const latest = settings.latest_packet;
  if (latest && (latest.security.id !== packet.security.id
    || latest.periods.some(p => p.period_end > (packet.periods[0]?.period_end ?? "")
      || p.reported_date > (packet.periods.find(old => old.period_end === p.period_end)?.reported_date ?? ""))
    || latest.screenings.some(s => !packet.screenings.some(old => old.methodology === s.methodology && old.immutable_hash === s.immutable_hash))
    || latest.items.filter(i => i.kind === "price").some(i => i.date > packet.items.filter(i => i.kind === "price").map(i => i.date).sort().at(-1)!)))
    stale.push("stale:newer_evidence");
  for (const id of stale) add("freshness", "Packet is stale or behind stored evidence", id);
  const limitations = new Set(parsed.data.data_limitations.flatMap(l => l.covers));
  for (const id of [...packet.items.filter(i => i.unavailable).map(i => i.id), ...stale])
    if (!limitations.has(id)) add("data_limitations", `Missing data limitation: ${id}`, "data_limitations");
  for (const id of limitations)
    if (!byId.get(id)?.unavailable && !stale.includes(id)) add("data_limitations", `Unknown limitation reference: ${id}`, "data_limitations");
  if (settings.stage === "publish" && (!settings.disclosure_resolved || !settings.context_line_resolved))
    add("disclosure", "Publish requires the short context line and approved AI/analyst disclosure", "disclosure");
  return issues;
}
export function validationReport(value: unknown, packet: ResearchPacket, settings: ValidationSettings) {
  return { validator_version: VALIDATOR_VERSION, banned_phrases_version: BANNED_PHRASES_VERSION,
    banned_ar_version: BANNED_AR_VERSION, banned_en_version: BANNED_EN_VERSION,
    style_guide_version: STYLE_GUIDE.version, issues: validateResearchDraft(value, packet, settings) };
}
