import en from "./messages/en.json";
import ar from "./messages/ar.json";
import followUp from "./approved-arabic-follow-up.json";
import { isolateArabicCode } from "./bidi";

type Pair = readonly [english: string, arabic: string];
const pair = (english: string, arabic: string): Pair => [english, arabic];
// D-130: explicit display contracts; these never change stored evidence.
export const presentationLabels = {
  result: {
    pass: pair("Pass", "اجتاز المعيار"), borderline: pair("Borderline", "نتيجة حدية"),
    fail: pair("Fail", "لم يجتز المعيار"), unknown: pair("Unknown", "غير معروف"),
  },
  confidence: { High: pair("High", "مرتفعة"), Medium: pair("Medium", "متوسطة"), Low: pair("Low", "منخفضة") },
  tier: {
    Verified: pair("Verified evidence", "بيانات متحقق منها"), Calculated: pair("Calculated", "محسوبة"),
    Estimated: pair("Estimated", "تقديرية"), "AI Interpretation": pair("AI interpretation", "تفسير بالذكاء الاصطناعي"),
  },
  inputState: {
    reported: pair("Reported", "مُفصح عنها"), derived: pair("Derived", "مشتقة"),
    estimated: pair("Estimated", "تقديرية"), unknown: pair("Unknown", "غير معروف"), missing: pair("Missing", "غير متوفرة"),
  },
  adequacy: {
    adequate: pair("Adequate", "كافية"), adequate_with_estimates: pair("Adequate with estimates", "كافية مع تقديرات"),
    inadequate: pair("Inadequate", "غير كافية"),
  },
  sourceType: {
    annual_report: pair("Annual report", "تقرير سنوي"), interim_report: pair("Interim report", "تقرير مرحلي"),
    regulatory_filing: pair("Regulatory filing", "إفصاح تنظيمي"), investor_relations: pair("Investor relations", "علاقات المستثمرين"),
    market_data: pair("Market data", "بيانات السوق"), data_provider: pair("Data provider", "مزوّد بيانات"),
    methodology_document: pair("Methodology document", "وثيقة المنهجية"), company_website: pair("Company website", "موقع الشركة"),
    news: pair("News", "أخبار"), internal: pair("Internal", "داخلي"),
  },
  scale: {
    absolute: pair("Unscaled", "بالقيمة الكاملة"), thousands: pair("Thousands", "آلاف"),
    millions: pair("Millions", "ملايين"), billions: pair("Billions", "مليارات"),
    shares: pair("Shares", "أسهم"), percent: pair("Percent", "نسبة مئوية"),
    boolean: pair("Yes / no", "نعم / لا"),
  },
  thresholdUnit: {
    percent_of_total_revenue: pair("Percent of total revenue", "نسبة من إجمالي الإيرادات"),
    percent_of_total_assets: pair("Percent of total assets", "نسبة من إجمالي الأصول"),
    percent_of_market_cap: pair("Percent of market capitalization", "نسبة من القيمة السوقية"),
    boolean: pair("Yes / no", "نعم / لا"), absolute: pair("Absolute value", "قيمة مطلقة"),
  },
  direction: { max: pair("Maximum", "الحد الأقصى"), min: pair("Minimum", "الحد الأدنى"), boolean: pair("Yes / no", "نعم / لا") },
  lineItem: {
    total_revenue: pair("Total revenue", "إجمالي الإيرادات"), prohibited_income: pair("Prohibited income", "الإيرادات غير المباحة"),
    total_assets: pair("Total assets", "إجمالي الأصول"), total_equity: pair("Total equity", "إجمالي حقوق الملكية"),
    interest_bearing_debt: pair("Interest-bearing debt", "الديون بفوائد"),
    finance_lease_liabilities: pair("Finance lease liabilities", "التزامات الإيجار التمويلي"),
    operating_lease_liabilities: pair("Operating lease liabilities", "التزامات الإيجار التشغيلي"),
    cash_and_equivalents: pair("Cash and cash equivalents", "النقد وما في حكمه"),
    interest_bearing_investments: pair("Interest-bearing investments", "الاستثمارات بفوائد"),
    accounts_receivable: pair("Accounts receivable", "الذمم المدينة"), net_income: pair("Net income", "صافي الدخل"),
    operating_cash_flow: pair("Operating cash flow", "التدفق النقدي التشغيلي"), shares_outstanding: pair("Shares outstanding", "الأسهم القائمة"),
    market_cap: pair("Market capitalization", "القيمة السوقية"), market_value_basis: pair("Market value basis", "أساس القيمة السوقية"),
    ebitda: pair("Earnings before interest, taxes, depreciation and amortization", "الأرباح قبل الفوائد والضرائب والإهلاك والاستهلاك"),
    prior_year_revenue: pair("Prior-year revenue", "إيرادات السنة السابقة"),
    prior_year_net_income: pair("Prior-year net income", "صافي دخل السنة السابقة"),
    business_segments: pair("Business segments", "قطاعات الأعمال"),
  },
  // D-138 explicitly supersedes D-131 activity pairs, not classifications.
  activity: {
    conventional_finance: pair("Conventional finance", "التمويل التقليدي"),
    interest_based_lending: pair("Interest-based lending", "الإقراض بفائدة"),
    insurance_conventional: pair("Conventional insurance", "التأمين التقليدي"),
    alcohol: pair("Alcohol", "الكحول"),
    tobacco: pair("Tobacco", "التبغ"),
    gambling: pair("Gambling", "القمار"),
    adult_entertainment: pair("Adult entertainment", "الترفيه للبالغين"),
    pork_related: pair("Pork-related", "منتجات الخنزير"),
    conventional_media: pair("Conventional media and entertainment", "الإعلام والترفيه التقليدي"),
    weapons_conventional: pair("Conventional weapons", "الأسلحة التقليدية"),
    generic_permissible: pair("General permissible activity", "نشاط مباح عام"),
    real_estate_permissible: pair("Permissible real estate", "عقار مباح"),
    technology: pair("Technology", "التقنية"),
    healthcare: pair("Healthcare", "الرعاية الصحية"),
    retail_permissible: pair("Permissible retail", "تجزئة مباحة"),
    industrials: pair("Industrials", "الصناعة"),
    energy: pair("Energy", "الطاقة"),
    telecom: pair("Telecommunications", "الاتصالات"),
    unclassified: pair("Unclassified", "غير مصنّف"),
  },
  licence: {
    licensed: pair("Licensed", "مرخّص"), public_document: pair("Public document", "وثيقة متاحة للعموم"),
    unlicensed_adapted: pair("Adapted without a licence", "مُعدّل دون ترخيص"), internal: pair("Internal", "داخلي"), unknown: pair("Unknown", "غير معروف"),
  },
  methodSource: {
    official: pair("Official", "رسمي"), adapted: pair("Adapted", "مُعدّل"), internal_example: pair("Internal example", "مثال داخلي"),
  },
  methodType: {
    equity_screening: pair("Equity screening", "فحص الأسهم"), fund_screening: pair("Fund screening", "فحص الصناديق"),
    portfolio_screening: pair("Portfolio screening", "فحص المحافظ"),
  },
  workflow: {
    draft: pair("Draft", "مسودة"), source_verified: pair("Source verified", "تم التحقق من المصدر"),
    rules_normalized: pair("Rules normalized", "تم توحيد صياغة القواعد"), tests_passed: pair("Tests passed", "اجتازت الاختبارات"),
    universe_tested: pair("Universe tested", "تم اختبار نطاق الأوراق المالية"), human_reviewed: pair("Human reviewed", "تمت المراجعة البشرية"),
    approved: pair("Approved", "موافَق عليه"), production: pair("Production", "مُعتمد للاستخدام الفعلي"),
  },
  severity: { blocking: pair("Blocking", "مانع"), review: pair("Review", "للمراجعة"), informational: pair("Informational", "للمعلومات") },
  criterionType: {
    business_activity: pair("Business activity", "نشاط الشركة"), non_permissible_revenue: pair("Non-permissible revenue", "الإيرادات غير المباحة"),
    interest_bearing_debt: pair("Interest-bearing debt", "الديون بفوائد"), cash_and_investments: pair("Cash and investments", "النقد والاستثمارات"),
    receivables: pair("Receivables", "الذمم المدينة"), custom_ratio: pair("Custom ratio", "نسبة مخصّصة"),
  },
} as const;

export type LabelFamily = keyof typeof presentationLabels | "structured";

/** Approved phrase reuse only: marked JSON entries never become approvals. */
function messagePairs(english: object, arabic: object): Pair[] {
  return Object.entries(english).flatMap(([key, source]) => {
    const translated = (arabic as Record<string, unknown>)[key];
    if (typeof source === "string" && typeof translated === "string")
      return translated.includes("⟦AR-REVIEW⟧") ? [] : [[source, translated] as Pair];
    return source && translated && typeof source === "object" && typeof translated === "object"
      ? messagePairs(source, translated) : [];
  });
}

export const publicUiCopy: Readonly<Record<string, string>> = Object.fromEntries([
  ...messagePairs(en, ar),
  ...Object.values(presentationLabels).flatMap(family => Object.values(family)).filter(([, text]) => !text.includes("⟦AR-REVIEW⟧")),
  ["English only", "متاح بالإنجليزية فقط"], ["Arabic only", "متاح بالعربية فقط"],
  ["All recorded criteria passed. No additional status reasons were recorded.", "اجتاز السهم جميع المعايير المسجلة. لم تُسجّل أسباب إضافية."],
  ["No specific status reasons were recorded.", "لم تُسجّل أسباب محددة للنتيجة."],
  ["Unrecognized label", "تسمية غير معروفة"], ["Ticker or company name", "رمز السهم أو اسم الشركة"],
  ["Not screened yet", "لم يُفحص بعد"], ["Page not found", "الصفحة غير موجودة"],
  ["Confidence tier", "فئة جودة البيانات"], ["Input state", "حالة المدخلات"], ["Data adequacy", "كفاية البيانات"],
  ["Result", "النتيجة"], ["Fundamentals", "البيانات المالية الأساسية"], ["Unit", "الوحدة"],
  ["Show calculation", "عرض الحساب"], ["Calculation", "الحساب"],
  ["Field", "الحقل"], ["Claim", "البيان"], ["Reason", "السبب"], ["Input", "المدخل"], ["Inputs", "المدخلات"],
  ["Definition", "التعريف"], ["Amount", "المبلغ"], ["Count", "العدد"], ["Yes", "نعم"], ["No", "لا"],
  // Bounded founder approval, independent of documentation-only draft files.
  ...Object.entries(followUp),
].map(([source, text]) => [source, isolateArabicCode(text)]));

// Known structured evidence keys: unknown keys deliberately do not leak as labels.
const structuredLabels = {
  category: "Business activity", activity_category: "Business activity",
  prohibited_categories: "Business activity", non_permissible_categories: "Business activity",
  field: "Field", field_or_input: "Field", claim: "Claim", reason: "Reason", reason_code: "Reason",
  input: "Input", inputs: "Inputs", definition: "Definition", amount: "Amount", count: "Count",
  value: "Value", value_text: "Value", label: "Label", criterion_label: "Criterion", criterion: "Criterion",
  result: "Result", ratio: "Ratio", threshold: "Threshold", threshold_unit: "Threshold unit",
  numerator: "Numerator", numerator_value: "Numerator", numerator_definition: "Numerator",
  denominator: "Denominator", denominator_value: "Denominator", denominator_definition: "Denominator",
  input_state: "Input state", input_states: "Input state", confidence_tier: "Confidence tier",
  confidence: "Confidence", data_adequacy: "Data adequacy", source: "Source", source_ids: "Sources",
  source_id: "Source", sources: "Sources", source_type: "Type", period: "Period", period_end: "Period end",
  unit: "Unit", unit_scale: "Unit", currency: "Unit", severity: "Severity", why_missing: "Why missing",
  effect: "Effect", calculation_trace: "Calculation", borderline_margin: "Borderline margin",
  line_item: "Label", name: "Name", reasonCode: "Reason", criterionId: "Criterion", thresholdUnit: "Threshold unit",
} as const;

export function displayLabel(family: LabelFamily, value: string | null | undefined, locale: "ar" | "en"): string {
  if (!value) return "—";
  if (family === "structured") {
    const source = Object.hasOwn(structuredLabels, value) ? structuredLabels[value as keyof typeof structuredLabels] : undefined;
    if (source) return locale === "ar" ? publicUiCopy[source] ?? `⟦AR-REVIEW⟧ ${source}` : source;
  } else {
    const labels: Readonly<Record<string, Pair>> = presentationLabels[family];
    if (Object.hasOwn(labels, value)) return labels[value][locale === "ar" ? 1 : 0];
  }
  return locale === "ar" ? "تسمية غير معروفة" : "Unrecognized label";
}
