import { validDate } from "../selection";
import type { TableRow } from "./contracts";

export const fsnDate = (value: string) => /^\d{8}$/.test(value)
  ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}` : "";
export function numeric(value: string) {
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function monthEnd(value: string) {
  if (!validDate(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
export function consolidated(row: TableRow) {
  return row.uom === "USD" && row.coreg === "" && numeric(row.dimn) === 0 &&
    /^(?:0x)?0+$/i.test(row.dimh) && numeric(row.iprx) === 1;
}
export function periodKey(row: TableRow) {
  return JSON.stringify([row.ddate, numeric(row.qtrs), numeric(row.datp), numeric(row.durp)]);
}
/** D-154: exact fiscal dates come from companyfacts. FSN rounds dates;
 * offsets identify the NUM context, not a guessed conversion between formats.
 */
export function matchesEnd(row: TableRow, end: string) {
  return fsnDate(row.ddate) === monthEnd(end) && numeric(row.datp) !== null && numeric(row.durp) !== null;
}
