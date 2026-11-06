import type { ReactNode } from "react";
import glossary from "../../../content/glossary/glossary.json";
import "./PublicPolish.css";
import { uxPolishText } from "../../i18n/proposed-arabic-ux-polish";

type Locale = "ar" | "en";
const terms: Record<string, { en: string; ar: string }> = glossary.terms;
/** Stored definition keys that share an explanation with a glossary term. */
const aliases: Record<string, string> = { non_permissible_revenue: "prohibited_income" };

export function glossaryKey(value: string): string | null {
  const key = Object.hasOwn(aliases, value) ? aliases[value] : value;
  return Object.hasOwn(terms, key) ? key : null;
}

export function glossaryDefinition(value: string, locale: Locale): string | null {
  const key = glossaryKey(value);
  return key ? terms[key][locale] : null;
}

const sheetId = (key: string, idSuffix: string) => `term-${key}-${idSuffix}`.replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * Tap-to-explain trigger: wraps a term inside a sentence and opens a native
 * popover (no client JavaScript). Render the matching <TermSheet> outside the
 * sentence so the sentence text holds only the label. Unknown keys render the
 * label unchanged. Display only.
 */
export function TermExplain({ term, idSuffix, children }: {
  term: string;
  idSuffix: string;
  children: ReactNode;
}) {
  const key = glossaryKey(term);
  if (!key) return <>{children}</>;
  return (
    <button type="button" className="term-trigger" popoverTarget={sheetId(key, idSuffix)} data-term={key}>
      {children}
    </button>
  );
}

/** The popover: a bottom sheet on phones, a small centred card elsewhere. */
export function TermSheet({ term, idSuffix, locale, title }: {
  term: string;
  idSuffix: string;
  locale: Locale;
  title: ReactNode;
}) {
  const key = glossaryKey(term);
  if (!key) return null;
  const id = sheetId(key, idSuffix);
  return (
    <div id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className="term-sheet" lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <p className="term-sheet-title" id={`${id}-title`}>{title}</p>
      <p className="term-sheet-body">{terms[key][locale]}</p>
      <button type="button" className="term-sheet-close" popoverTarget={id} popoverTargetAction="hide">
        {uxPolishText(locale, "termClose")}
      </button>
    </div>
  );
}
