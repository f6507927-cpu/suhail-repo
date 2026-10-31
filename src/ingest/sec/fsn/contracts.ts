import type { mapAnnual } from "../annual";
import type { Retrieval } from "../types";

export const FSN_PROVIDER = "SEC Financial Statement and Notes data set" as const;
export const FSN_VERSION = "sec-fsn-1";
export const REVIEW_TICKERS = ["AAPL", "MSFT", "AMD", "TXN", "NFLX", "PEP", "LLY", "XOM"] as const;
export type AnnualMapping = ReturnType<typeof mapAnnual>;
export type FsnTarget = { ticker: string; cik: string; mapped: AnnualMapping };
export type TableRow = Record<string, string>;
export type FsnArchive = { submissions: TableRow[]; numbers: TableRow[]; retrieval: Retrieval };
export type CustomTag = {
  ticker: string; cik: string; tag: string; field: "prohibited_income"; reviewReference: string;
};
// Deliberately empty: suggestions are not approval. Add only founder-reviewed
// exact tags with a per-entry fixture test and a filing-evidence reference.
export const CUSTOM_TAG_ALLOWLIST: readonly CustomTag[] = [];

export function accession(target: FsnTarget) {
  return target.mapped.period.filing_reference;
}
export function revenueTag(target: FsnTarget) {
  return target.mapped.facts.find(f => f.line_item === "total_revenue")?.mapping_note.split(" = ")[0] ?? "";
}
