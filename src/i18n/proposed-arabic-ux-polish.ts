/**
 * UX polish (stock answer, recently viewed, term explanations).
 *
 * Every Arabic string here is a PROPOSAL awaiting founder approval. It is listed
 * with its English source in docs/UX_POLISH_ARABIC_APPROVAL.md and must not be
 * merged into the shared approved registry (approved-arabic.ts) until approved.
 * Templates are fixed text; placeholders are filled only from stored status,
 * stored reason objects and stored company identity — never generated prose.
 */
export const uxPolishPairs = {
  answerPass: { en: "{company}: {status} under the selected methodology.", ar: "{company}: {status} وفق المنهجية المختارة." },
  answerWithReason: { en: "{company}: {status}, because {reason}.", ar: "{company}: {status}، لأن {reason}." },
  answerPlain: { en: "{company}: {status}.", ar: "{company}: {status}." },
  reasonFailure: { en: "the {label} criterion did not pass", ar: "معيار {label} لم يجتز الفحص" },
  reasonBorderline: { en: "the {label} criterion is close to its limit", ar: "معيار {label} قريب من حدّه" },
  reasonUnknown: { en: "data for the {label} criterion is not available", ar: "بيانات معيار {label} غير متوفرة" },
  recentTitle: { en: "Stocks you viewed recently", ar: "أسهم شاهدتها مؤخرًا" },
  recentNote: { en: "Saved only in this browser.", ar: "محفوظة في هذا المتصفح فقط." },
  recentClear: { en: "Clear", ar: "مسح" },
  recentClearLabel: { en: "Clear stocks you viewed recently", ar: "مسح الأسهم التي شاهدتها مؤخرًا" },
  termClose: { en: "Close", ar: "إغلاق" },
} as const satisfies Record<string, { en: string; ar: string }>;

export type UxPolishKey = keyof typeof uxPolishPairs;

export function uxPolishText(locale: "ar" | "en", key: UxPolishKey, values: Record<string, string> = {}) {
  return uxPolishPairs[key][locale].replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? values[name] : match);
}
