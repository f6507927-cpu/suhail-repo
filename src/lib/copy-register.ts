import ar from "../i18n/messages/ar.json";
import en from "../i18n/messages/en.json";

// Reference §10.4 + §4.6; Arabic-language narrative remains deferred (D-63).
// English fallback copy is checked even on Arabic pages. No invented Arabic bans.
export const HARD_BAN_PATTERNS = [
  "buy", "sell", "buying", "selling", "recommend", "recommendation",
  "overweight", "underweight", "outperform", "underperform",
  "target price", "price target", "fair value of", "will rise", "will fall",
  "guaranteed", "sure to", "halal", "haram", "haraam", "fatwa",
  "religiously compliant", "shariah[- ]compliant", "islamically compliant",
  "certified", "approved by scholars", "endorsed",
  "advice", "should buy", "sure thing", "opportunity of the year", "don['’]t miss out",
] as const;
export const WARNING_PATTERNS = ["stars?", "navigation", "journeys?", "horizons?"] as const;
export type RegisterCheck = { ok: boolean; hardBans: string[]; warnings: string[] };
export function checkRegister(text: string, locale: "ar" | "en"): RegisterCheck {
  // D-120: exact mandated disclaimers only, never arbitrary negative sentences.
  const dictionaries = locale === "ar" ? [ar, en] : [en, ar];
  let checked = text;
  for (const dictionary of dictionaries) {
    for (const copy of [dictionary.disclaimer.short, dictionary.disclaimer.full]) {
      checked = checked.replaceAll(copy, " ");
    }
  }
  const matches = (patterns: readonly string[]) => [...new Set(patterns.flatMap((pattern) => checked.match(new RegExp(`\\b(?:${pattern})\\b`, "giu")) ?? []))];
  const hardBans = matches(HARD_BAN_PATTERNS);
  return { ok: hardBans.length === 0, hardBans, warnings: matches(WARNING_PATTERNS) };
}
