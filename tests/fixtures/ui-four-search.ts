import type { SearchResult } from "../../src/db/search-public";
/** Deterministic UI-only records; no writes, live screening or company-name approvals. */
export function uiFourResults(count = 10): SearchResult[] {
  const statuses: SearchResult["status"][] = [
    "passes_selected_methodology", "fails_selected_methodology",
    "requires_review", "insufficient_data", null,
  ];
  return Array.from({ length: count }, (_, index) => ({
    slug: `fixture-${index}`, ticker: `FIX${index}`,
    name: `English Source Company ${index}`, display_name_en: `Display Company ${index}`,
    name_ar: index % 2 === 0 ? `شركة الاختبار ${index}` : null,
    exchange: index % 2 === 0 ? "NYSE" : "NASDAQ", status: statuses[index % 5]!,
  }));
}
