/** Shared private/public marker policy; private audit decision references remain intact. */
export function stripReviewMarker(text: string) {
  return text.replace(/⟦AR-REVIEW⟧\s*/g, "");
}

/** Public display only: no internal decision references, including linked ID lists. */
export function stripPublicReviewMarker(text: string) {
  if (!/\bD-\d+\b/.test(text)) return stripReviewMarker(text);
  return stripReviewMarker(text)
    .replace(/\bD-\d+(?:\s*\/\s*D-\d+)*\s*:?\s*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(?:\(\s*\)|\[\s*\])/g, "")
    .trim();
}

/** Content language, not the presence of a review token, determines isolation. */
export function isEnglishText(text: string) {
  return /[A-Za-z]/.test(text) && !/[\u0621-\u064a\u066e-\u06d3]/.test(text);
}
