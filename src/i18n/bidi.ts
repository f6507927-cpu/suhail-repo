/** Isolate literal code tokens without changing their visible spelling or ICU arguments. */
export function isolateArabicCode(text: string): string {
  if (text.startsWith("⟦AR-REVIEW⟧")) return text;
  return text.replace(
    /(?<![\w{\u2066])(?:[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+|CIK|DELETE|JSON|HTTPS|UUID|null)(?![\w\u2069])/g,
    (token) => `\u2066${token}\u2069`,
  );
}
