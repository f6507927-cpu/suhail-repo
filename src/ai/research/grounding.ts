import type { PacketItem, ResearchPacket } from "./contracts";
import { normalizeArabic } from "./banned-phrases";
import { roundDecimal } from "./decimal";
import { renderFigures } from "./draft";

export type Claim = {
  raw: string; value: number | string; kind: "number" | "percent" | "date" | "year";
  /** A rendered figure retains its evidence/type instead of being reinterpreted as prose. */
  item_id?: string;
  currency?: string;
  magnitude?: number;
  unit_conflict?: boolean;
  token_modified?: boolean;
  multiple_tokens?: boolean;
  /** Internal parser positions, stripped from returned rendered claims. */
  span?: { start: number; end: number };
};
export function westernDigits(text: string, preservePositions = false) {
  return text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g,
    c => String(c.charCodeAt(0) - (c <= "\u0669" ? 0x660 : 0x6f0)))
    .replace(/\u066b/g, ".").replace(/\u066c/g, ",").replace(/\u066a/g, "%")
    .replace(/[\u061c\u200e\u200f\u2066-\u2069]/g, preservePositions ? " " : "");
}
const months = [
  ["january", "jan", "يناير"], ["february", "feb", "فبراير"], ["march", "mar", "مارس"], ["april", "apr", "أبريل", "ابريل"],
  ["may", "مايو"], ["june", "jun", "يونيو"], ["july", "jul", "يوليو"], ["august", "aug", "أغسطس", "اغسطس"],
  ["september", "sep", "sept", "سبتمبر"], ["october", "oct", "أكتوبر", "اكتوبر"], ["november", "nov", "نوفمبر"], ["december", "dec", "ديسمبر"],
];
const monthIndex = new Map(months.flatMap((names, i) => names.map(name => [normalizeArabic(name), i + 1] as const)));
const monthPattern = months.flat().join("|");
const magnitudePattern = "trillion|billion|million|thousand|تريليون|مليارات|مليار|ملايين|مليون|آلاف|ألف|الف|[TBMK]";
// Fixed vocabulary, not an ambient Intl currency inventory. Explicit unfamiliar
// symbols fail closed rather than losing their unit and becoming bare amounts.
const currencyCodes = ("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD "
  + "CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD "
  + "HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD "
  + "MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD "
  + "SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES "
  + "VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG ZWL").split(" ");
const currencyPattern = `US\\$|US\\s+dollars?|dollars?|${currencyCodes.join("|")}|\\p{Sc}|دولار(?:اً|ا|ات)?(?:\\s+[أا]مريكي)?`;
function currencyCode(value: string | undefined) {
  const normalized = normalizeArabic(value?.trim() ?? "");
  if (["$", "us$", "usd", "us dollar", "us dollars", "dollar", "dollars",
    "دولار", "دولارا", "دولارات", "دولار امريكي", "دولارا امريكي"].includes(normalized)) return "USD";
  if (["€", "eur"].includes(normalized)) return "EUR";
  if (["£", "gbp"].includes(normalized)) return "GBP";
  if (value && currencyCodes.includes(value.trim())) return value.trim();
  if (value && /^\p{Sc}$/u.test(value.trim())) return `ambiguous:${value.trim()}`;
  return undefined;
}
export function extractClaims(value: string, detectYearContext = true, preservePositions = false): Claim[] {
  let text = westernDigits(value, preservePositions);
  const claims: Claim[] = [];
  const locate = (claim: Claim, start: number, length: number) => {
    if (preservePositions) claim.span = { start, end: start + length };
    claims.push(claim);
  };
  const date = (raw: string, year: string, month: number, day: string, position: number) => {
    const claim: Claim = { raw, kind: "date", value: `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}` };
    if (new RegExp(`(${currencyPattern})\\s*$`, "iu").test(text.slice(0, position))
      || new RegExp(`^\\s*(?:[%٪]|${currencyPattern})`, "iu").test(text.slice(position + raw.length)))
      claim.unit_conflict = true;
    locate(claim, position, raw.length);
    return " ".repeat(raw.length);
  };
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (raw, y: string, m: string, d: string, at: number) => date(raw, y, Number(m), d, at));
  text = text.replace(new RegExp(`(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`, "giu"),
    (raw, d: string, m: string, y: string, at: number) => date(raw, y, monthIndex.get(normalizeArabic(m))!, d, at));
  text = text.replace(new RegExp(`(${monthPattern})\\s+(\\d{1,2}),?\\s+(\\d{4})`, "giu"),
    (raw, m: string, d: string, y: string, at: number) => date(raw, y, monthIndex.get(normalizeArabic(m))!, d, at));
  // Ambiguous numeric dates are not silently interpreted as separate grounded numbers.
  text = text.replace(/\b\d{1,4}([/.-])\d{1,2}\1\d{1,4}\b/g, (raw, _separator: string, at: number) => {
    locate({ raw, kind: "date", value: `ambiguous:${raw}` }, at, raw.length); return " ".repeat(raw.length);
  });
  const pattern = new RegExp(`(?<currency>(?:${currencyPattern})?\\s*)(?<number>[+-]?\\d+(?:,\\d{3})*(?:\\.\\d+)?)(?:\\s*(?<magnitude>${magnitudePattern})(?![\\p{L}\\p{N}]))?\\s*(?<percent>%?)(?:\\s*(?<currencySuffix>${currencyPattern})(?![\\p{L}\\p{N}]))?`, "giu");
  for (const match of text.matchAll(pattern)) {
    const groups = match.groups!;
    let n = Number(groups.number.replace(/,/g, ""));
    const mag = normalizeArabic(groups.magnitude ?? "");
    const multiplier: Record<string, number> = { t: 1e12, trillion: 1e12, "تريليون": 1e12,
      b: 1e9, billion: 1e9, "مليار": 1e9, "مليارات": 1e9,
      m: 1e6, million: 1e6, "مليون": 1e6, "ملايين": 1e6,
      k: 1e3, thousand: 1e3, "الف": 1e3, "الاف": 1e3 };
    n *= multiplier[mag] ?? 1;
    // D-190: a year-shaped amount is still an amount. Only explicit calendar
    // language gives a typed *prose* number the year role. Figure tokens never
    // take this path: their packet item determines their type.
    const prefix = normalizeArabic(text.slice(0, match.index!));
    const yearContext = detectYearContext && /(?:\b(?:in|during|since|year|fy)\s*|(?<!\p{L})(?:عام|سنة|لسنة|لعام)\s*)$/iu.test(prefix);
    const currency = currencyCode(groups.currency), suffix = currencyCode(groups.currencySuffix);
    const claim: Claim = { raw: match[0].trim(), value: n, kind: groups.percent ? "percent"
      : yearContext && !groups.magnitude && !currency && !suffix && /^(?:1|2)\d{3}$/.test(groups.number) ? "year" : "number" };
    if (currency || suffix) claim.currency = currency ?? suffix;
    if (currency && suffix && currency !== suffix) claim.unit_conflict = true;
    if (mag) claim.magnitude = multiplier[mag];
    locate(claim, match.index!, match[0].length);
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
export function packetDates(packet: ResearchPacket, items: PacketItem[]) {
  const periods = new Set(items.map(i => i.period));
  return [...new Set([...items.map(i => i.date),
    ...items.filter(i => i.unit === "date" && typeof i.value === "string").map(i => String(i.value)),
    ...packet.periods.filter(p => periods.has(p.id)).flatMap(p => [p.period_end, p.reported_date])])];
}
/** Parse COMPLETE rendered expressions; token spans retain provenance, never hide suffixes. */
export function renderedClaims(text: string, packet: ResearchPacket, locale: "ar" | "en") {
  let rendered = "";
  const spans: { start: number; end: number; id: string; modified: boolean; currencyMismatch: boolean }[] = [];
  const expression = /\{\{fig:([^{}]+)\}\}/g;
  let position = 0;
  for (const token of text.matchAll(expression)) {
    rendered += text.slice(position, token.index);
    const expanded = renderFigures(token[0], packet, locale);
    const item = packet.items.find(i => i.id === token[1])!;
    const after = text.slice(token.index! + token[0].length), before = text.slice(0, token.index);
    const changedUnit = new RegExp(`^\\s*(?:[%٪]|(?:${magnitudePattern})(?![\\p{L}\\p{N}]))`, "iu").test(after);
    const prefixCurrency = currencyCode(before.match(new RegExp(`(${currencyPattern})\\s*$`, "iu"))?.[1]);
    const suffixCurrency = currencyCode(after.match(new RegExp(`^\\s*(${currencyPattern})(?![\\p{L}\\p{N}])`, "iu"))?.[1]);
    spans.push({ start: rendered.length + 1, end: rendered.length + expanded.length - 1, id: item.id,
      modified: changedUnit, currencyMismatch: [prefixCurrency, suffixCurrency].some(c => c !== undefined && c !== item.unit) });
    rendered += expanded;
    position = token.index! + token[0].length;
  }
  rendered += text.slice(position);
  // Bidi controls are transparent, not separators: two adjacent tokens must
  // not become two independent amounts merely because each has an isolate.
  const masked = rendered.replace(/\{\{cite:[^{}]+\}\}/g, cite => " ".repeat(cite.length));
  const normalizedSpans = spans.map(span => ({ ...span,
    start: westernDigits(masked.slice(0, span.start)).length,
    end: westernDigits(masked.slice(0, span.end)).length,
  }));
  const claims = extractClaims(westernDigits(masked), true, true).map(({ span, ...claim }) => {
    const tokens = normalizedSpans.filter(t => span && t.start < span.end && t.end > span.start);
    if (tokens.length === 1) {
      claim.item_id = tokens[0].id;
      if (claim.kind === "year") claim.kind = "number";
    }
    if (tokens.length > 1) claim.multiple_tokens = true;
    if (tokens.some(t => t.modified)) claim.token_modified = true;
    if (tokens.some(t => t.currencyMismatch)) claim.unit_conflict = true;
    return claim;
  });
  return { rendered, claims };
}
export function isGrounded(claim: Claim, items: PacketItem[], dates: string[]) {
  if (claim.token_modified || claim.multiple_tokens || claim.unit_conflict) return false;
  if (claim.item_id) items = items.filter(i => i.id === claim.item_id);
  if (claim.kind === "date") return claim.item_id
    ? items.some(i => !i.unavailable && i.unit === "date" && i.value === claim.value)
    : dates.includes(String(claim.value));
  if (claim.kind === "year") return dates.some(d => d.slice(0, 4) === String(claim.value));
  return items.some(i => !i.unavailable && typeof i.value === "number"
    && (claim.kind === "percent" ? i.unit.startsWith("percent") && !claim.currency : !i.unit.startsWith("percent"))
    && (!claim.currency || i.unit === claim.currency)
    && withinTolerance(Number(claim.value), i.value));
}
