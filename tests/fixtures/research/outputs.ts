import type { ModelDraft } from "../../../src/ai/research/draft";
import { assembleDraft } from "../../../src/ai/research/draft";
import type { ResearchPacket } from "../../../src/ai/research/contracts";

// Hand-written bilingual test prose, NOT approved product copy or real research.
const plain = { ar: "هذا نص اصطناعي لاختبار عرض الأدلة.", en: "This is synthetic prose for evidence testing." };
export function handwrittenModel(packet: ResearchPacket): ModelDraft {
  const id = packet.items.find(i => i.id.startsWith("px.close."))!.id;
  const price = { ar: `قيمة الإغلاق المخزنة {{fig:${id}}}.`, en: `The stored closing value is {{fig:${id}}}.` };
  return {
    title: { ar: "بحث اصطناعي للاختبار", en: "Synthetic fixture research" },
    summary: plain, plain_summary: [
      { ar: "نشاط الشركة موضح في سجل الأدلة الاصطناعي.", en: "The business is described in synthetic evidence." },
      { ar: "سياق الفحص المستقل أدناه من النتائج المخزنة.", en: "The separate screening context below uses stored results." },
      { ar: "قد تغير البيانات الجديدة التقييم.", en: "New evidence could change the view." },
    ],
    business_overview: plain,
    financial_highlights: [{ text: price, cites: [id] }], strengths: [{ text: plain, cites: ["id.activity"] }],
    risks: [{ text: plain, cites: [] }], valuation_discussion: plain,
    analyst_view: { label: "neutral", reasons: [{ text: plain, cites: ["id.activity"] }] },
    what_would_change_the_view: [{ text: plain, cites: [] }], open_questions_for_analyst: [{ text: plain, cites: [] }],
    data_limitations: packet.items.filter(i => i.unavailable).map(item => ({
      text: { ar: "هذا العنصر غير متاح في الأدلة الاصطناعية.", en: "This item is unavailable in the synthetic evidence." },
      cites: [item.id], covers: [item.id],
    })),
  };
}
export const NEGATIVE_CASES = [
  { id: "wrong-number", check: "grounding" },
  { id: "missing-cite", check: "citations" },
  { id: "banned-phrase", check: "banned_phrase" },
  { id: "wrong-status", check: "status" },
  { id: "missing-arabic", check: "schema" },
] as const;
export function recordedOutput(packet: ResearchPacket, version: "handwritten-v1" | "deliberately-bad-v0", index: number) {
  const draft = assembleDraft(handwrittenModel(packet), packet);
  if (version === "handwritten-v1") return draft;
  switch (NEGATIVE_CASES[index % NEGATIVE_CASES.length].id) {
    case "wrong-number":
      draft.plain_summary[0] = { ar: "القيمة 987654321012345.", en: "The value is 987654321012345." }; break;
    case "missing-cite":
      draft.summary = { ar: "القيمة 24.5.", en: "The value is 24.5." }; break;
    case "banned-phrase":
      draft.summary = { ar: "هذا مضمون.", en: "This is guaranteed." }; break;
    case "wrong-status":
      draft.shariah_context[0].status = draft.shariah_context[0].status === "requires_review" ? "insufficient_data" : "requires_review"; break;
    case "missing-arabic":
      draft.summary.ar = ""; break;
  }
  return draft;
}
