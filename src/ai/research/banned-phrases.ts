export const BANNED_PHRASES_VERSION = "research-banned-1";
export const BANNED_EN_VERSION = "research-banned-en-1";
export const BANNED_AR_VERSION = "research-banned-ar-1";
export const ARABIC_LIST_STATUS = "Founder-approved, provisional (D-222)";
export interface BannedPhrase {
  phrase: string; reason: string; severity: "block" | "warn";
}
const entries = (phrases: string[], reason: string): BannedPhrase[] =>
  phrases.map(phrase => ({ phrase, reason, severity: "block" }));
/** D-190: reference §10.4 is the minimum floor, not a permissive vocabulary. */
export const BANNED_EN: BannedPhrase[] = [
  ...entries(["buy", "sell", "buying", "selling", "recommend", "recommendation", "overweight", "underweight",
    "outperform", "underperform", "target price", "price target", "fair value of", "will rise", "will fall",
    "guaranteed", "sure to", "sure thing", "opportunity of the year", "don't miss out", "risk-free", "risk free"],
  "Recommendation, prediction or promotional certainty"),
  ...entries(["halal", "haram", "haraam", "fatwa", "religiously compliant", "shariah-compliant", "shariah compliant",
    "islamically compliant", "certified", "approved by scholars", "endorsed"], "Religious ruling or endorsement"),
  ...entries(["you should buy", "you should sell", "your portfolio", "position sizing", "portfolio sizing",
    "allocate your", "invest your"], "Personalised investment advice"),
];
// D-222 approves these exact safety entries, not Arabic UI or disclosure copy.
export const BANNED_AR: BannedPhrase[] = [
  ...entries(["اشتر", "اشتري", "شراء", "بع", "بيع", "توصية", "أوصي", "السعر المستهدف", "القيمة العادلة",
    "سيرتفع حتماً", "سينخفض حتماً", "مضمون", "مضمونة", "بلا مخاطر", "بدون مخاطر"], "Recommendation or certainty"),
  ...entries(["حلال", "حرام", "فتوى", "معتمد شرعياً", "متوافق شرعياً", "أقره العلماء"], "Religious ruling or endorsement"),
  ...entries(["يجب عليك", "محفظتك", "خصص من", "حجم المركز"], "Personalised investment advice"),
];
export function normalizeArabic(text: string) {
  return text.normalize("NFKC").replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/[ىی]/g, "ي").replace(/ک/g, "ك").toLowerCase();
}
export function containsPhrase(text: string, phrase: string) {
  const escaped = normalizeArabic(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu").test(normalizeArabic(text));
}
