import { uiEightStoredVersion, uiEightVersion } from "./approved-arabic-ui-eight";
// D-157: founder-approved 5 November 2026. Presentation only; historical pins stand.
export const uiOneLabels: Readonly<Record<string, readonly [ar: string, en: string]>> = {
  "Prohibited primary business activity": ["النشاط الرئيسي للشركة", "Primary business activity"],
  "Interest-bearing debt / market value basis": ["الديون بفوائد إلى القيمة السوقية", "Interest-bearing debt to market value"],
  "Prohibited income / total revenue": ["الإيرادات غير المباحة إلى إجمالي الإيرادات", "Non-permissible income to total revenue"],
  "Research implementation based on publicly documented criteria from Al Rajhi Capital": ["تطبيق بحثي مستقل مبني على معايير الراجحي المالية المنشورة", "Independent research based on Al Rajhi Capital's published criteria"],
  "Adapted research 1.0 — draft": ["الإصدار 1.0 · مسودة", "Version 1.0 · Draft"],
  "Founder-authorized 25-security US research draft only; provisional G1 decisions remain pending analyst review.": ["نسخة بحثية أولية تغطي أسهماً أمريكية مختارة، وما زالت قراراتها قيد مراجعة المحلل الشرعي.", "An early research version covering selected US stocks. Its decisions are still pending Shariah analyst review."],
  "Founder-authorized draft preparation only.": ["إعداد أولي للنسخة البحثية.", "Initial research version."],
  "Suhail independent research": ["سهيل · بحث مستقل", "Suhail · Independent research"],
  "Admin": ["فريق سهيل", "The Suhail team"],
  "null": ["لا ينطبق", "Not applicable"],
  "review": ["تحتاج النتيجة إلى مراجعة", "The result needs review"],
  "no segment disclosure recorded": ["لم يُسجَّل إفصاح عن القطاعات", "No segment disclosure recorded"],
  "numerator unavailable; no value assumed": ["الرقم غير متاح، ولم نفترض أي قيمة", "Figure unavailable; no value assumed"],
  "البسط غير متاح؛ لم تُفترض أي قيمة.": ["الرقم غير متاح، ولم نفترض أي قيمة.", "البسط غير متاح؛ لم تُفترض أي قيمة."],
  "prohibited_income": ["الإيرادات غير المباحة", "Non-permissible income"],
  "interest_bearing_debt": ["الديون بفوائد", "Interest-bearing debt"],
  "market_value_basis": ["أساس القيمة السوقية", "Market value basis"],
  "total_revenue": ["إجمالي الإيرادات", "Total revenue"],
  "business_segments": ["قطاعات الأعمال", "Business segments"],
  "— ÷ $479B": ["الرقم غير متاح", "Figure unavailable"],
  "Closing price on": ["سعر الإغلاق في", "Closing price on"],
  "Prices: API Ninjas": ["الأسعار: API Ninjas", "Prices: API Ninjas"],
  "Unchanged": ["دون تغيير", "Unchanged"],
  "No screening run recorded for this methodology yet.": ["لم يُفحص هذا السهم بعد.", "This stock hasn't been screened yet."],
  "No result is shown because no stored run is available.": ["ستظهر النتيجة هنا بعد فحصه.", "The result will appear here once it's screened."],
  "الحالة أعلاه أنتجها المحرك الحتمي. لا يغيّرها نموذج لغوي أبدًا.": ["تصدر هذه النتيجة عن محرك حساب ثابت، ولا يغيّرها الذكاء الاصطناعي.", "This result comes from a fixed calculation engine. AI never changes it."],
};

/** Exact approved values only. Unknown evidence retains its existing fallback. */
export function uiOneDisplay(value: string, locale: "ar" | "en"): string {
  if (value === uiEightStoredVersion) return uiEightVersion[locale].full;
  // English dictionary alias for the same approved engine-statement row.
  if (value === "The state above was produced by the deterministic engine. A language model never changes it.")
    return engineDisplayStatement[locale === "ar" ? 0 : 1];
  return Object.hasOwn(uiOneLabels, value) ? uiOneLabels[value][locale === "ar" ? 0 : 1] : value;
}

/** Known tokens inside stored calculation prose; unknown surrounding text survives. */
export function uiOneProse(value: string, locale: "ar" | "en"): string {
  const exact = uiOneDisplay(value, locale);
  if (exact !== value) return exact;
  return Object.entries(uiOneLabels).reduce((text, [source, pair]) => {
    if (["Admin", "null", "review", "— ÷ $479B"].includes(source)) return text;
    return text.replaceAll(source, pair[locale === "ar" ? 0 : 1]);
  }, value);
}

export const engineDisplayStatement = uiOneLabels["الحالة أعلاه أنتجها المحرك الحتمي. لا يغيّرها نموذج لغوي أبدًا."];
export const missingFigure = uiOneLabels["— ÷ $479B"];
export function isSuppliedDraft(value: string | null | undefined) {
  return value === "Adapted research 1.0 — draft" ||
    value === uiEightStoredVersion;
}

/** The caveat remains in full record/methodology, not in the compact verdict line. */
export function stockShortVersionLabel(value: string, locale: "ar" | "en") {
  return value === uiEightStoredVersion
    ? uiEightVersion[locale].short
    : uiOneDisplay(value, locale);
}
