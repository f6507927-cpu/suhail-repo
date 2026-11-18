import { buildResearchPacket } from "../../../src/ai/research/packet";
import { assembleDraft, type ModelDraft } from "../../../src/ai/research/draft";
import { fixtureInput, fixturePackets, FIXTURE_CLOCK } from "./packets";
import { handwrittenModel } from "./outputs";

/** Hand-written, bilingual, synthetic regressions; never approved product prose. */
export function groundingRegressionFixtures() {
  const packet = fixturePackets[0];
  const make = (id: string, text: { ar: string; en: string }, cites: string[], expected: "grounding" | null) => {
    const model = handwrittenModel(packet);
    model.financial_highlights[0] = { text, cites };
    return { id, packet, draft: assembleDraft(model, packet), expected };
  };
  const cases = [
    make("unsupported-year-shaped-amount", {
      ar: "بلغت الإيرادات ٢٠٢٥.", en: "Revenue was 2025.",
    }, ["id.activity"], "grounding"),
    make("swapped-sentence-citations", {
      ar: "الإغلاق 24.5 {{cite:fin.total_revenue.FY2025}}. الإيرادات 120 مليون {{cite:px.close.2026-10}}.",
      en: "Close was 24.5 {{cite:fin.total_revenue.FY2025}}. Revenue was 120 million {{cite:px.close.2026-10}}.",
    }, [], "grounding"),
    make("cross-sentence-token-leak", {
      ar: "الإغلاق 24.5 {{cite:fin.total_revenue.FY2025}}. الإغلاق المخزن {{fig:px.close.2026-10}}.",
      en: "Close was 24.5 {{cite:fin.total_revenue.FY2025}}. Stored close was {{fig:px.close.2026-10}}.",
    }, [], "grounding"),
    make("explicit-block-citations", {
      ar: "الإغلاق 24.5. الإيرادات 120 مليون.",
      en: "Close was 24.5. Revenue was 120 million.",
    }, ["px.close.2026-10", "fin.total_revenue.FY2025"], null),
    make("explicit-calendar-year", {
      ar: "الفترة في عام ٢٠٢٥.", en: "The period was in 2025.",
    }, ["fin.total_revenue.FY2025"], null),
    make("calendar-year-needs-local-evidence", {
      ar: "الفترة في عام ٢٠٢٥.", en: "The period was in 2025.",
    }, ["id.activity"], "grounding"),
  ];
  // A figure can resemble a packet year, or a year absent from every date.
  // Neither case changes its numeric packet type.
  for (const value of [2025, 2049]) {
    const rows = fixtureInput(); rows.prices[0].close = value;
    const numericPacket = buildResearchPacket(rows, FIXTURE_CLOCK);
    const model = handwrittenModel(numericPacket);
    cases.push({ id: `numeric-token-${value}`, packet: numericPacket, draft: assembleDraft(model, numericPacket), expected: null });
    const typed: ModelDraft = structuredClone(model);
    typed.financial_highlights[0].text = { ar: `الإغلاق ${value}.`, en: `Close was ${value}.` };
    cases.push({ id: `numeric-typed-${value}`, packet: numericPacket, draft: assembleDraft(typed, numericPacket), expected: null });
  }
  return cases;
}
