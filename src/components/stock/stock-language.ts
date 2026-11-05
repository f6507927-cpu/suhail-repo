import type { PublicStockData } from "@/stock/types";
import { publicMethodologyVersionLabel } from "@/i18n/methodology-labels";
import { uiOneDisplay, uiOneProse } from "@/i18n/approved-arabic-ui-one";
import { criteriaNeedFallback, hasEnglishOnlyNarrative,
  statusReasonsNeedFallback, structuredEvidenceNeedsFallback, unknownsNeedFallback } from "./StockVerdictParts";
import arabicMessages from "@/i18n/messages/ar.json";
import englishMessages from "@/i18n/messages/en.json";

/** D-159: name only sections actually displaying English, including closed evidence. */
export function stockEnglishOnlySections(data: PublicStockData): string[] {
  const sections: string[] = [];
  // UI-1: identities/source titles are excluded; inspect the mapped narrative actually shown.
  const english = (value: string | null | undefined) => hasEnglishOnlyNarrative(uiOneProse(value || "", "ar"));
  if (data.run && (english(data.methodology?.name || data.run.methodology_name) ||
    english(publicMethodologyVersionLabel(uiOneDisplay(
      data.version?.version_label || data.version?.version || data.run?.methodology_version_label || "", "ar"))) ||
    english(data.methodology?.scope))) sections.push("Methodology");
  if (data.run) {
    if (statusReasonsNeedFallback(data.run.status_reasons)) sections.push("Why this assessment");
    if (criteriaNeedFallback(data.criteria)) sections.push("Criteria");
    if (unknownsNeedFallback(data.unknowns)) sections.push("What we don't know");
    if (data.explanation && (structuredEvidenceNeedsFallback(data.explanation.evidence) ||
      structuredEvidenceNeedsFallback(data.explanation.unknowns))) sections.push("Structured evidence");
  }
  if (data.run && data.facts.some(fact => fact.value === null && english(fact.value_text))) sections.push("Fundamentals");
  const analyst = data.run?.status === "passes_selected_methodology" && data.security.coverage_analyst_id ? data.analyst : null;
  if (analyst && ((!analyst.name_ar?.trim() && english(analyst.name_en)) ||
    (!analyst.title_ar?.trim() && english(analyst.title_en)) || english(analyst.credentials)))
    sections.push("Coverage by");
  const pick = data.publishedPick;
  if (pick) {
    const narrative = [[pick.thesis_ar, pick.thesis_en], [pick.why_now_ar, pick.why_now_en],
      [pick.valuation_ar, pick.valuation_en], [pick.disclosure_ar, pick.disclosure_en]];
    const canonical = [englishMessages.disclaimer.short, englishMessages.disclaimer.full,
      arabicMessages.disclaimer.short, arabicMessages.disclaimer.full];
    if (english(pick.edition_label) || narrative.some(([ar, en]) => !ar?.trim() && english(en)) ||
      (pick.risks_ar ?? pick.risks_en ?? []).some(english) ||
      (pick.disclaimer && !canonical.includes(pick.disclaimer) && english(pick.disclaimer)))
      sections.push("Read the research");
  }
  return sections;
}
