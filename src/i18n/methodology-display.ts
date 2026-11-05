import { uiOneProse } from "./approved-arabic-ui-one";
import { stripPublicReviewMarker } from "./display-text";

/** Presentation only. Never rewrite the stored document or infer workflow state. */
export function methodologyDisplay(value: string, locale: "ar" | "en") {
  return stripPublicReviewMarker(uiOneProse(value, locale));
}

/** A draft-labelled record remains publicly provisional even if its flags are enabled. */
export function isDraftMethodologyLabel(value: string | null | undefined) {
  return Boolean(value && (/\bdraft\b/i.test(value) || /مسودة/.test(value)));
}
