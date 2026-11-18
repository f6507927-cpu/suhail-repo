import type { PacketItem, ResearchPacket } from "./contracts";
import { normalizeArabic } from "./banned-phrases";
import { roundDecimal } from "./decimal";

export type Claim = { raw: string; value: number | string; kind: "number" | "percent" | "date" | "year" };
export function westernDigits(text: string) {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,
    c => String(c.charCodeAt(0) - (c <= "\u0669" ? 0x660 : 0x6f0)))
    .replace(/\u066b/g, ".").replace(/\u066c/g, ",").replace(/\u066a/g, "%")
    .replace(/[\u200e\u200f\u2066-\u2069]/g, "");
}
const months = [
  ["january", "jan", "يناير"], ["february", "feb", "فبراير"], ["march", "mar", "مارس"], ["april", "apr", "أبريل", "ابريل"],
  ["may", "مايو"], ["june", "jun", "يونيو"], ["july", "jul", "يوليو"], ["august", "aug", "أغسطس", "اغسطس"],
  ["september", "sep", "sept", "سبتمبر"], ["october", "oct", "أكتوبر", "اكتوبر"], ["november", "nov", "نوفمبر"], ["december", "dec", "ديسمبر"],
];
const monthIndex = new Map(months.flatMap((names, i) => names.map(name => [normalizeArabic(name), i + 1] as const)));
const monthPattern = months.flat().join("|");
export function extractClaims(value: string): Claim[] {
  let text = westernDigits(value);
  const claims: Claim[] = [];
  const date = (raw: string, year: string, month: number, day: string) => {
    claims.push({ raw, kind: "date", value: `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}` });
    return " ".repeat(raw.length);
  };
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (raw, y: string, m: string, d: string) => date(raw, y, Number(m), d));
  text = text.replace(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`, "giu"),
    (raw, d: string, m: string, y: string) => date(raw, y, monthIndex.get(normalizeArabic(m))!, d));
  text = text.replace(new RegExp(`(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "giu"),
    (raw, m: string, d: string, y: string) => date(raw, y, monthIndex.get(normalizeArabic(m))!, d));
  // Ambiguous numeric dates are not silently interpreted as separate grounded numbers.
  text = text.replace(/\b\d{1,4}([/.-])\d{1,2}\1\d{1,4}\b/g, raw => {
    claims.push({ raw, kind: "date", value: `ambiguous:${raw}` }); return " ".repeat(raw.length);
  });
  const pattern = /(?<currency>[$€£]?\s*)(?<number>[+-]?\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(?<magnitude>trillion|billion|million|thousand|تريليون|مليارات|مليار|ملايين|مليون|آلاف|ألف|الف|[TBMK])(?![\p{L}\p{N}]))?\s*(?<percent>%?)/giu;
  for (const match of text.matchAll(pattern)) {
    const groups = match.groups!;
    let n = Number(groups.number.replace(/,/g, ""));
    const mag = normalizeArabic(groups.magnitude ?? "");
    const multiplier: Record<string, number> = { t: 1e12, trillion: 1e12, "تريليون": 1e12,
      b: 1e9, billion: 1e9, "مليار": 1e9, "مليارات": 1e9,
      m: 1e6, million: 1e6, "مليون": 1e6, "ملايين": 1e6,
      k: 1e3, thousand: 1e3, "الف": 1e3, "الاف": 1e3 };
    n *= multiplier[mag] ?? 1;
    claims.push({ raw: match[0].trim(), value: n, kind: groups.percent ? "percent"
      : !groups.magnitude && !groups.currency.trim() && /^(?:1|2)\d{3}$/.test(groups.number) ? "year" : "number" });
  }
  return claims;
}
/** Reference §10.4: strict boundaries; relative tolerance is less than, not ≤, 0.5%. */
export function withinTolerance(claim: number, allowed: number) {
  if (!Number.isFinite(claim) || !Number.isFinite(allowed)) return false;
  return claim === allowed || Math.abs(claim - allowed) < 0.005
    || claim === roundDecimal(allowed, 0)
    || claim === roundDecimal(allowed, 1)
    || (allowed !== 0 && Math.abs((claim - allowed) / allowed) < 0.005);
}
export function packetDates(packet: ResearchPacket) {
  return [...new Set([...packet.items.map(i => i.date),
    ...packet.items.filter(i => i.unit === "date" && typeof i.value === "string").map(i => String(i.value)),
    ...packet.periods.flatMap(p => [p.period_end, p.reported_date]),
    ...packet.screenings.flatMap(s => [s.data_as_of, s.run_at.slice(0, 10)])])];
}
export function isGrounded(claim: Claim, items: PacketItem[], dates: string[]) {
  if (claim.kind === "date") return dates.includes(String(claim.value));
  if (claim.kind === "year") return dates.some(d => d.slice(0, 4) === String(claim.value));
  return items.some(i => !i.unavailable && typeof i.value === "number"
    && (claim.kind !== "percent" || i.unit.startsWith("percent"))
    && withinTolerance(Number(claim.value), i.value));
}
