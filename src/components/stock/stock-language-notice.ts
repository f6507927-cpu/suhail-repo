import type { PublicStockData } from "@/stock/types";
import { stockEnglishOnlySections } from "./stock-language";

/** UI-1: one stock notice, named by the rendered narrative sections from main. */
export function stockNeedsEnglishNotice(data: PublicStockData): boolean {
  return stockEnglishOnlySections(data).length > 0;
}
