import { uiOneProse } from "./approved-arabic-ui-one";
import { stripPublicReviewMarker } from "./display-text";

/** Presentation only. Never rewrite the stored document or infer workflow state. */
export function methodologyDisplay(value: string, locale: "ar" | "en") {
  return stripPublicReviewMarker(uiOneProse(value, locale));
}

/** D-182: recorded workflow wins over stale label prose; legacy data may lack it. */
export function isDraftMethodologyLabel(value: string | null | undefined, workflow?: string | null) {
  if (workflow) return workflow === "draft";
  return Boolean(value && (/\bdraft\b/i.test(value) || /مسودة/.test(value)));
}
