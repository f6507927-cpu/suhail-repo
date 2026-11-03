import type { TableRow } from "./contracts";
import { numeric } from "./period";

const reference = (row: TableRow) => JSON.stringify([row.tag, row.version]);
const standard = (tag: string, version: string) => version.startsWith("us-gaap/") && tag;
const liability = (tag: string, version: string) =>
  standard(tag, version) && /^(?:Liabilit|StockholdersEquity|PartnersCapital|MembersEquity)/.test(tag);
/** Names only identify potential blockers, NEVER mapped values. */
export const possibleFinancialAsset = (row: TableRow) =>
  /cash|deposit|invest|securit|marketable|trading|financial.?assets|money.?market/i.test(`${row.tag} ${row.plabel}`);

/** Keep distinct CAL groups separate. Versions are part of identity. */
function descendants(calculations: TableRow[], assets: boolean) {
  const found = new Set<string>();
  for (const group of new Set(calculations.map(row => row.grp))) {
    const arcs = calculations.filter(row => row.grp === group);
    const roots = arcs.filter(row => assets ? standard(row.ptag, row.pversion) && row.ptag === "Assets"
      : liability(row.ptag, row.pversion));
    const pending = roots.map(row => JSON.stringify([row.ptag, row.pversion]));
    const visited = new Set<string>();
    while (pending.length) {
      const parent = pending.pop()!;
      if (visited.has(parent)) continue;
      visited.add(parent); found.add(parent);
      for (const arc of arcs) if (JSON.stringify([arc.ptag, arc.pversion]) === parent)
        pending.push(JSON.stringify([arc.ctag, arc.cversion]));
    }
  }
  return found;
}

/** A normal PRE report lists asset details before its Assets total. CAL supplies
 * explicit membership when presentation order is insufficient. No report/Assets
 * boundary and no classifiable CAL network means unknown, not inferred zeros.
 */
export function assetScope(presentation: TableRow[], calculations: TableRow[]) {
  const assets = descendants(calculations, true), liabilities = descendants(calculations, false);
  const lines: TableRow[] = [];
  const fail = (reason: string) => ({ lines: [], reason });
  for (const report of new Set(presentation.map(row => row.report))) {
    if (!report) return fail("Balance-sheet asset scope lacks PRE report identity");
    const rows = presentation.filter(row => row.report === report);
    const main = rows.filter(row => numeric(row.inpth) === 0);
    if (!main.length) continue; // Parenthetical reports do not establish absence.
    if (rows.some(row => numeric(row.line) === null || !Number.isInteger(numeric(row.line)) || Number(row.line) < 0))
      return fail("Balance-sheet asset scope has invalid PRE line order");
    const totals = main.filter(row => row.tag === "Assets" && standard(row.tag, row.version));
    const distinctTotals = new Set(totals.map(row => row.line));
    const before = distinctTotals.size === 1 ? rows.filter(row => Number(row.line) <= Number(totals[0].line)) : [];
    const mixedOrder = before.some(row => liability(row.tag, row.version) || liabilities.has(reference(row)));
    if (before.length && !mixedOrder) {
      // Include CAL-confirmed asset lines even when a rendered detail follows its total.
      lines.push(...rows.filter(row => before.includes(row) || assets.has(reference(row))));
    } else {
      const candidates = rows.filter(possibleFinancialAsset);
      if (!assets.size || candidates.some(row => !assets.has(reference(row)) && !liabilities.has(reference(row))))
        return fail("Cannot prove the Assets boundary from PRE/CAL");
      lines.push(...rows.filter(row => assets.has(reference(row))));
    }
    if (main.some(row => assets.has(reference(row)) && liabilities.has(reference(row))))
      return fail("Conflicting asset and liability CAL membership");
  }
  return lines.length ? { lines, reason: null } : fail("No proven Assets section in balance-sheet presentation");
}
