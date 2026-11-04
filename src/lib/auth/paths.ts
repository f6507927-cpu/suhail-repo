export function localePath(locale: string, path: string) {
  return `${locale === "en" ? "/en" : ""}${path === "/" ? (locale === "en" ? "" : "/") : path}`;
}
// D-46: reject encoded delimiters as well as browser URL normalization bypasses.
export function safeNext(input: unknown): string | null {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(input)) return null;
  const url = new URL(input, "https://relative.invalid");
  if (url.origin !== "https://relative.invalid" || url.pathname !== input.split(/[?#]/)[0]) return null;
  if (input.includes("%")) {
    // UX-8: only a bounded search query may contain escaped query data.
    // Encoded path delimiters and every other destination remain forbidden.
    const query=url.searchParams.get("q");
    if(!/^\/(?:en\/|ar\/)?search$/.test(url.pathname) || url.hash ||
      [...url.searchParams.keys()].length!==1 || query===null ||
      query.trim().length<1 || query.trim().length>40 || query.includes("\0"))return null;
  }
  if (/^\/(?:(?:en|ar)\/)?(?:auth|admin\/mfa)(?:\/|$)/.test(url.pathname)) return null;
  return input;
}
