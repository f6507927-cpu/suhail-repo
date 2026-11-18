/** D-187: these scans are conservative blockers, not a claim of PII detection completeness. */
export function hasEmail(text: string) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/u.test(text);
}
export function hasPhone(text: string) {
  const normalized = text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,
    c => String(c.charCodeAt(0) - (c <= "\u0669" ? 0x660 : 0x6f0)))
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => " ".repeat(date.length));
  for (const match of normalized.matchAll(/(?<![\d.,])\+?\d[\d ()-]*\d(?!\d|[.,]\d)/gu)) {
    const candidate = match[0], digits = candidate.replace(/\D/g, "");
    if (digits.length > 15) continue;
    if (/^\+[1-9]/u.test(candidate) && digits.length >= 7) return true;
    // A bare financial figure is not evidence of a phone number. Domestic
    // numbers require phone-style grouping or an explicit contact label.
    const contact = /(?:\b(?:phone|tel|mobile|call)|هاتف|جوال|اتصل)\s*[:：]?\s*$/iu.test(normalized.slice(0, match.index));
    const groupedFigure = /^\d{1,3}(?:[ -]\d{3})+$/u.test(candidate);
    const groups = candidate.split(/\D+/u).filter(Boolean);
    const groupedPhone = groups.length >= 2 && groups.length <= 6
      && groups.every((g, index) => g.length >= (index === 0 ? 1 : 2) && g.length <= 4);
    if (digits.length >= 9 && (contact || (groupedPhone && !groupedFigure))) return true;
  }
  return false;
}
export function assertPacketPrivacy(value: unknown): void {
  if (typeof value === "string" && hasEmail(value)) throw new Error("Personal data in research evidence");
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (/^(?:user(?:_id)?|analyst(?:_id|_profile)?|email|actor(?:_.*)?|audit(?:_.*)?)$/i.test(key))
      throw new Error("Personal data key in research evidence");
    if (typeof entry === "string" && ["name", "label", "explanation", "activity", "field"].includes(key)
      && (hasPhone(entry) || /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i.test(entry)))
      throw new Error("Personal contact or identifier in research text");
    assertPacketPrivacy(entry);
  }
}
