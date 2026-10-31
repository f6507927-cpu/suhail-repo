import { candidates, prohibitedIncomeWarning } from "../mapping";
import { validDate } from "../selection";
import type { MappedFact } from "../types";
import { accession, revenueTag, CUSTOM_TAG_ALLOWLIST, FSN_PROVIDER, FSN_VERSION, type FsnArchive, type FsnTarget, type TableRow } from "./contracts";

const date = (value: string) => /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : "";
function numeric(value: string) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function consolidated(row: TableRow) {
  return row.uom === "USD" && row.coreg === "" && row.dimn === "0" && /^0+$/.test(row.dimh) && row.iprx === "1";
}
function periodKey(row: TableRow) {
  return JSON.stringify([row.ddate, Number(row.qtrs), Number(row.datp), Number(row.durp)]);
}
function matchesEnd(row: TableRow, end: string) {
  const normalized = date(row.ddate);
  if (!validDate(normalized) || numeric(row.datp) === null || numeric(row.durp) === null) return false;
  const actual = new Date(`${end}T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(actual.getUTCFullYear(), actual.getUTCMonth() + 1, 0));
  const offset = (actual.getTime() - monthEnd.getTime()) / 86_400_000;
  // SEC datp is rounded to four decimal places; restore against the exact
  // companyfacts end, not against a guessed calendar fiscal year.
  return normalized === monthEnd.toISOString().slice(0, 10) &&
    Math.abs(Number(row.datp) - offset / monthEnd.getUTCDate()) <= 0.000051;
}
export function targetRefusal(target: FsnTarget) {
  const revenue = target.mapped.facts.find(f => f.line_item === "total_revenue");
  if (revenue?.value == null || !revenue.source) return "No companyfacts total_revenue value/source to anchor the ratio";
  if (revenue.source.document_reference !== accession(target))
    return "Companyfacts total_revenue accession differs from the selected annual filing";
  if (revenue.as_of_date !== target.mapped.period.period_end) return "Companyfacts total_revenue fiscal period differs from the selected annual period";
  return null;
}

/** Exact joins only. Labels/custom-tag name searches never select a value. */
export function mapFsn(target: FsnTarget, archive: FsnArchive) {
  const rows = archive.numbers.filter(row => row.adsh === accession(target));
  const submissions = archive.submissions.filter(row => row.adsh === accession(target) && Number(row.cik) === Number(target.cik));
  const suggestions = submissions.length === 1 ? rows.filter(row =>
    row.version === row.adsh && /Interest|InvestmentIncome/.test(row.tag)).map(row => ({
    tag: row.tag, value: numeric(row.value), unit: row.uom, periodEnd: date(row.ddate),
    qtrs: row.qtrs, datp: row.datp, durp: row.durp, dimensions: row.dimn, coreg: row.coreg,
    accession: row.adsh, reviewOnly: true,
  })) : [];
  const refuse = (reason: string) => ({ fact: null as MappedFact | null, tag: null as string | null, reason, suggestions });
  const conflict = targetRefusal(target);
  if (conflict) return refuse(conflict);
  if (submissions.length !== 1) return refuse("Missing or ambiguous SUB identity for the selected CIK and accession");
  const sub = submissions[0], period = target.mapped.period;
  if (!["10-K", "10-K/A"].includes(sub.form) || sub.fp !== "FY" || Number(sub.fy) !== period.fiscal_year ||
    date(sub.period) !== period.period_end || date(sub.filed) !== period.reported_date)
    return refuse("SUB filing metadata does not match the selected annual filing and fiscal period");
  const existing = target.mapped.facts.find(f => f.line_item === "prohibited_income");
  if (existing?.value != null) return refuse("Companyfacts already supplies prohibited_income; fallback not used");
  const revenue = target.mapped.facts.find(f => f.line_item === "total_revenue")!;
  const anchors = rows.filter(row => row.tag === revenueTag(target) && row.version.startsWith("us-gaap/") &&
    consolidated(row) && row.qtrs === "4" && matchesEnd(row, period.period_end) && numeric(row.value) === revenue.value);
  const keys = new Set(anchors.map(periodKey));
  if (keys.size !== 1) return refuse("No unique NUM revenue anchor matching companyfacts tag, value and annual period");
  const key = [...keys][0];
  const custom = CUSTOM_TAG_ALLOWLIST.filter(entry => entry.ticker === target.ticker &&
    Number(entry.cik) === Number(target.cik) && entry.field === "prohibited_income");
  const ordered = [...candidates.prohibited_income.map(tag => ({ tag, custom: false })),
    ...custom.map(entry => ({ tag: entry.tag, custom: true }))];
  for (const candidate of ordered) {
    const matches = rows.filter(row => row.tag === candidate.tag &&
      (candidate.custom ? row.version === row.adsh : row.version.startsWith("us-gaap/")) &&
      consolidated(row) && row.qtrs === "4" && matchesEnd(row, period.period_end) && periodKey(row) === key);
    if (!matches.length) continue;
    const values = new Set(matches.map(row => numeric(row.value)));
    if (values.size !== 1 || values.has(null)) return refuse(`Ambiguous or missing numeric value for ${candidate.tag}`);
    const value = [...values][0]!;
    if (value < 0) return refuse(`Negative ${candidate.tag}; gross annual prohibited income unavailable`);
    const fact: MappedFact = {
      adapter: "sec_fsn", line_item: "prohibited_income", value, currency: "USD", unit: "USD", unit_scale: "absolute",
      input_state: "estimated", confidence_tier: "Estimated", as_of_date: period.period_end,
      calculation_version: FSN_VERSION, unknown_note: null,
      mapping_note: `sec_fsn ${candidate.tag} = ${value} USD; ${period.period_start} to ${period.period_end}; ` +
        `accession ${accession(target)}; taxonomy ${matches[0].version}; dataset ${archive.retrieval.url}; ` +
        `NUM revenue anchor ${revenueTag(target)} = ${revenue.value} USD; period ${key}` + prohibitedIncomeWarning(candidate.tag),
      source: {
        ...revenue.source!, provider: FSN_PROVIDER, label: `${FSN_PROVIDER}: ${sub.form} ${period.fiscal_year} ${accession(target)}`,
        retrieved_at: archive.retrieval.retrieved_at, confidence_tier: "Verified",
        is_demo: archive.retrieval.is_demo, is_synthetic: archive.retrieval.is_synthetic,
        production_blocked: archive.retrieval.is_demo || archive.retrieval.is_synthetic,
      },
    };
    return { fact, tag: candidate.tag, reason: null, suggestions };
  }
  return refuse("No allowed income tag with the same accession and fiscal period as total_revenue (USD, consolidated, iprx=1)");
}
export type FsnResult = ReturnType<typeof mapFsn>;
export function withFsn(target: FsnTarget, result: FsnResult): FsnTarget["mapped"] {
  if (!result.fact) {
    if (!result.reason) return target.mapped;
    return { ...target.mapped, facts: target.mapped.facts.map(f =>
      f.line_item === "prohibited_income" && f.value === null
        ? { ...f, unknown_note: `${f.unknown_note ?? "Income unavailable"}; sec_fsn: ${result.reason}`,
          mapping_note: `${f.mapping_note}; sec_fsn fallback refused: ${result.reason}` } : f) };
  }
  return { ...target.mapped, facts: target.mapped.facts.map(f => f.line_item === "prohibited_income" && f.value === null ? result.fact! : f) };
}
