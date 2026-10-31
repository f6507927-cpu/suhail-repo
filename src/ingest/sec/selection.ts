import type { CompanyFacts, Observation } from "./types";

export interface Entry extends Observation { tag: string; unit: string }
export interface AnnualSelection extends Entry { start: string; fiscalYear: number }
export function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
}
export const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
export function annual(entry: Observation): boolean {
  // 350–380 inclusive days accommodates 52/53-week years, not quarters/YTD.
  return entry.start !== undefined && validDate(entry.start) && validDate(entry.end) &&
    day(entry.end) - day(entry.start) + 1 >= 350 &&
    day(entry.end) - day(entry.start) + 1 <= 380 &&
    (entry.form === "10-K" || entry.form === "10-K/A") && entry.fp === "FY";
}
export function entries(data: CompanyFacts, tag: string): Entry[] {
  const [namespace, name] = tag.includes(":") ? tag.split(":") : ["us-gaap", tag];
  return Object.entries(data.facts[namespace]?.[name]?.units ?? {}).flatMap(([unit, values]) =>
    values.filter(v => Number.isFinite(v.val) && validDate(v.end) && validDate(v.filed) &&
      /^\d{10}-\d{2}-\d{6}$/.test(v.accn)).map(v => ({ ...v, tag, unit })));
}
/** Stable tie-breaks independent of SEC arrays/object iteration order. */
export function latest(a: Entry, b: Entry): number {
  return b.filed.localeCompare(a.filed) || b.accn.localeCompare(a.accn) ||
    b.form.localeCompare(a.form) || a.unit.localeCompare(b.unit) ||
    (a.start ?? "").localeCompare(b.start ?? "") || a.tag.localeCompare(b.tag) || a.val - b.val;
}
export function allAnnual(data: CompanyFacts): Entry[] {
  return Object.keys(data.facts["us-gaap"] ?? {}).flatMap(tag => entries(data, tag)).filter(annual);
}
export function selectAnnual(data: CompanyFacts): AnnualSelection {
  const rows = allAnnual(data).filter(e => e.unit === "USD");
  const chosen = rows.sort((a, b) => b.end.localeCompare(a.end) || latest(a, b))[0];
  if (!chosen) throw new Error("No usable annual 10-K/10-K/A duration evidence");
  // fy describes the filing, NOT each comparative observation. Select the filing's
  // latest duration end before using fy; prior-year selection never compares fy.
  const sameFiling = rows.filter(e => e.accn === chosen.accn && e.end === chosen.end);
  const starts = new Map<string, number>();
  for (const e of sameFiling) starts.set(e.start!, (starts.get(e.start!) ?? 0) + 1);
  const start = [...starts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const fiscalYears = sameFiling.map(e => e.fy).filter((v): v is number => Number.isInteger(v));
  const fiscalYear = fiscalYears.sort((a, b) => b - a)[0];
  if (fiscalYear === undefined) throw new Error("Annual filing lacks fiscal-year metadata");
  return { ...chosen, start, fiscalYear };
}
