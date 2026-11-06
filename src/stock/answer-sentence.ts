import type { StatusReason } from "../engine/types";
import { storedReasonToEngine } from "../components/stock/StockVerdictParts";
import { visibleReasons } from "./presentation";
import { stockCriterionLabel } from "../i18n/stock-labels";
import { stripPublicReviewMarker } from "../components/foundation/shared";
import { englishCompanyName } from "../lib/format";
import { uxPolishText } from "../i18n/proposed-arabic-ux-polish";
import ar from "../i18n/messages/ar.json";
import en from "../i18n/messages/en.json";
import type { PublicStockData } from "./types";

type Locale = "ar" | "en";

export type StockAnswer = {
  company: string;
  companyLang: Locale;
  /** Everything after the company name, already localized. */
  rest: string;
};

/** Reason kinds ordered by how directly they explain the stored status. */
const kindOrder: StatusReason["kind"][] = ["failure", "blocking_unknown", "criterion_unknown", "review_unknown", "borderline"];

function reasonClause(reason: StatusReason, locale: Locale): string | null {
  const label = stripPublicReviewMarker(stockCriterionLabel({ criterion_label: reason.label }, locale)).trim();
  if (!label) return null;
  if (reason.kind === "failure") return uxPolishText(locale, "reasonFailure", { label });
  if (reason.kind === "borderline") return uxPolishText(locale, "reasonBorderline", { label });
  if (reason.kind === "criterion_unknown" || reason.kind === "blocking_unknown" || reason.kind === "review_unknown")
    return uxPolishText(locale, "reasonUnknown", { label });
  return null;
}

/**
 * One-sentence answer for the stock hero. Fixed templates only, filled from the
 * stored status code, stored reason objects and stored company identity. It never
 * reads or changes numbers, thresholds or sources, and it is never AI text.
 */
export function stockAnswer(data: Pick<PublicStockData, "company" | "run">, locale: Locale): StockAnswer | null {
  const run = data.run;
  if (!run) return null;
  const arabicName = data.company.name_ar?.trim();
  const companyLang: Locale = locale === "ar" && arabicName ? "ar" : "en";
  const company = stripPublicReviewMarker(companyLang === "ar" && arabicName ? arabicName : englishCompanyName(data.company));
  const status = (locale === "ar" ? ar : en).status[run.status];
  const template = (key: "answerPass" | "answerWithReason" | "answerPlain", reason?: string) =>
    uxPolishText(locale, key, { company: "\u0000", status, reason: reason ?? "" }).split("\u0000")[1];

  if (run.status === "passes_selected_methodology") return { company, companyLang, rest: template("answerPass") };
  const parsed = (Array.isArray(run.status_reasons) ? run.status_reasons : [])
    .map(storedReasonToEngine)
    .filter((reason): reason is StatusReason => reason !== null);
  const reasons = visibleReasons(parsed);
  for (const kind of kindOrder) {
    for (const reason of reasons.filter(item => item.kind === kind)) {
      const clause = reasonClause(reason, locale);
      if (clause) return { company, companyLang, rest: template("answerWithReason", clause) };
    }
  }
  return { company, companyLang, rest: template("answerPlain") };
}

export function stockAnswerText(answer: StockAnswer) {
  return `${answer.company}${answer.rest}`;
}
