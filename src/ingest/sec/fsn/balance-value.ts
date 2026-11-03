import { accession, type FsnTarget, type TableRow } from "./contracts";
import { consolidated, matchesEnd, numeric, periodKey } from "./period";

/** Keep all NUM candidates, including excluded contexts, for diagnostics. Equal
 * duplicates collapse by value/context; iprx must never hide a conflict.
 */
export function readBalanceValue(target: FsnTarget, numbers: TableRow[], lines: TableRow[], anchor: TableRow) {
  const first = lines[0], versions = new Set(lines.map(row => row.version));
  const candidates = numbers.filter(row => row.adsh === accession(target) && row.tag === first.tag && versions.has(row.version));
  const rejection = (row: TableRow) => [
    ...(!consolidated(row) ? ["not consolidated zero-dimensional USD"] : []),
    ...(numeric(row.qtrs) !== 0 || numeric(row.durp) !== 0 ? ["not an instant"] : []),
    ...(numeric(row.datp) !== numeric(anchor.datp) ? ["different fiscal context (datp)"] : []),
    ...(!matchesEnd(row, target.mapped.period.period_end) ? ["different fiscal end"] : []),
    ...(numeric(row.value) === null || numeric(row.value)! < 0 ? ["unreadable or negative value"] : []),
  ].join("; ");
  const rows = candidates.filter(row => !rejection(row));
  const contexts = new Set(rows.map(periodKey)), values = new Set(rows.map(row => numeric(row.value)));
  const valid = contexts.size === 1 && values.size === 1 && new Set(rows.map(row => row.version)).size === 1;
  const reason = valid ? null : `Cannot read one nonnegative consolidated USD value for BS line ${first.tag}`;
  return {
    tag: first.tag, value: valid ? [...values][0]! : null, context: valid ? [...contexts][0] : null,
    row: rows[0], reason,
    rows: candidates.length ? candidates.map(row => ({ ...row, plabel: first.plabel,
      rejection: rejection(row) || (valid ? "" : "conflicting values or fiscal contexts") }))
      : [{ ...first, rejection: "no NUM candidates for this filing/tag/namespace" }],
  };
}
