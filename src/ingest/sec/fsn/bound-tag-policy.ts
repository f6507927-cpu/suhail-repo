import draft from "../../../../data/methodologies/al-rajhi-adapted-1.1-draft.json";
import { accession, type FsnTarget, type TableRow } from "./contracts";
import { assetPosition } from "./asset-scope";

export const CASH_SHORT_SUBTOTAL = "CashCashEquivalentsAndShortTermInvestments";
export const CASH_RESTRICTED_TOTAL = "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents";
export const EXCLUDED_EQUITY_METHOD = "EquityMethodInvestments";
type Component = keyof typeof draft.balance_sheet_tags;
/** Founder-approved exact entry. Local report bound-dry-run.txt identifies
 * INTC's tag namespace as accession 0000050863-26-000011, not us-gaap.
 */
export const CUSTOM_BOUND_TAG_ALLOWLIST: readonly {
  ticker: string; cik: string; tag: string; field: Component; reviewReference: string;
}[] = [{ ticker: "INTC", cik: "0000050863", tag: "EquityInvestments", field: "long_term",
  reviewReference: "D-155 upper-bound mapping addendum; accession 0000050863-26-000011" }];

export const standardBoundTag = (row: TableRow, tag: string) => row.version.startsWith("us-gaap/") && row.tag === tag;
export function mappedComponent(target: FsnTarget, row: TableRow, presentation: TableRow[], calculations: TableRow[]): Component | null {
  const standard = row.version.startsWith("us-gaap/");
  const custom = row.version === accession(target) && CUSTOM_BOUND_TAG_ALLOWLIST.find(entry =>
    entry.ticker === target.ticker && entry.cik === target.cik.padStart(10, "0") && entry.tag === row.tag);
  const name = standard ? (Object.keys(draft.balance_sheet_tags) as Component[]).find(name =>
    [...draft.balance_sheet_tags[name].totals, ...draft.balance_sheet_tags[name].components].includes(row.tag)) : custom ? custom.field : null;
  if (!name) return null;
  const position = assetPosition(row, presentation, calculations);
  if (name !== "cash" && (position === "ambiguous" ||
    (position !== null && position !== (name === "short_term" ? "current" : "noncurrent")))) return null;
  // These generic names do not establish maturity on their own.
  if (["MarketableSecurities", "MarketableSecuritiesAndEquitySecuritiesFVNI", "EquityInvestments"].includes(row.tag) &&
    position !== (name === "short_term" ? "current" : "noncurrent")) return null;
  return name;
}
