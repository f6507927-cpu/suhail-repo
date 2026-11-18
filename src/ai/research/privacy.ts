/** D-187: these scans are conservative blockers, not a claim of PII detection completeness. */
export function hasEmail(text: string) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/u.test(text);
}
export function hasPhone(text: string) {
  return /(?:\+?\d[\d ()-]{6,}\d)/u.test(text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,
    c => String(c.charCodeAt(0) - (c <= "\u0669" ? 0x660 : 0x6f0))));
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
