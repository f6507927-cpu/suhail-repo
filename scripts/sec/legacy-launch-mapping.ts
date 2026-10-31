/** Frozen pre-expansion (.4) rules for the launch comparison ONLY.
 * Annual selection is intentionally unchanged by this fix. This small reference
 * implements only the compared items; captured full .4 outputs are also retained.
 */
import { annual, entries, latest, selectAnnual } from "../../src/ingest/sec/selection";
import type { CompanyFacts } from "../../src/ingest/sec/types";
const debt = ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtCurrent", "ShortTermBorrowings", "CommercialPaper"];
export function legacyLaunchFact(data: CompanyFacts, line: string) {
  const selected = selectAnnual(data);
  if (line !== "interest_bearing_debt") {
    const tag = line === "prohibited_income" ? "InvestmentIncomeInterest" : "NetIncomeLoss";
    const rows = entries(data, tag).filter(e => ["10-K", "10-K/A"].includes(e.form) && e.fp === "FY");
    const e = rows.filter(e => e.unit === "USD" && e.start === selected.start && e.end === selected.end && annual(e)).sort(latest)[0];
    const negative = line === "prohibited_income" && e && e.val < 0;
    return { value: e && !negative ? e.val : null,
      input_state: e && !negative ? line === "prohibited_income" ? "estimated" : "reported" : "unknown",
      unknown_note: negative ? "Interest-income candidate is negative; gross annual prohibited income unavailable" :
        e ? null : rows.length ? `No compatible USD annual duration for ${selected.end} among: ${tag}` : `No XBRL value among: ${tag}` };
  }
  const rows = (tag: string) => entries(data, tag).filter(e => e.accn === selected.accn);
  const active = debt.filter(tag => !rows("LongTermDebt").length || !["LongTermDebtNoncurrent", "LongTermDebtCurrent"].includes(tag));
  const used = [], invalid = [];
  for (const tag of active) {
    const present = rows(tag);
    if (!present.length) continue;
    const match = present.filter(e => e.unit === "USD" && e.end === selected.end && e.start === undefined).sort(latest)[0];
    if (match) used.push(match);
    else invalid.push(`${tag}: incompatible unit/period (${present.map(r => `${r.val} ${r.unit}, ${r.start ?? "instant"} to ${r.end}`).join("; ")})`);
  }
  const incomplete = !used.some(e => e.tag === "LongTermDebt" || e.tag === "LongTermDebtNoncurrent");
  return { value: invalid.length || !used.length ? null : used.reduce((sum, e) => sum + e.val, 0),
    input_state: invalid.length || !used.length ? "unknown" : incomplete ? "estimated" : "derived",
    unknown_note: invalid.length ? `Unusable present component: ${invalid.join("; ")}` : !used.length ? `No XBRL value among: ${debt.join(", ")}` : null };
}
