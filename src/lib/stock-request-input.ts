import { normalizeSearch } from "./search-normalization";
export type StockRequestRow={normalized_query:string;created_at:string};
export function normalizedStockRequest(input:unknown):string|null {
  if(typeof input!=="string" || input.trim().length<1 || input.trim().length>40 || input.includes("\0"))return null;
  const normalized=normalizeSearch(input);
  return normalized.length>=1 && normalized.length<=40 ? normalized : null;
}
