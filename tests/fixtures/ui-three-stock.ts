import type { PublicStockData } from "../../src/stock/types";
import { uiTwoFixture } from "./ui-two-stock";
import { setUiOneStatus } from "./ui-one-stock";

export const uiThreeStatuses = [
  "passes_selected_methodology", "fails_selected_methodology",
  "requires_review", "insufficient_data", null,
] as const;
export function uiThreeFixture(status: NonNullable<PublicStockData["run"]>["status"] | null) {
  const data = uiTwoFixture();
  data.company.name = data.company.display_name_en = "UI-3 display fixture";
  data.exchange = { name: "NASDAQ", code: "NASDAQ" };
  data.company.sector_label = "National Commercial Banks";
  data.version!.version = "1.1";
  data.version!.version_label = "Analyst custom draft label retaining a deliberately long qualifier for layout verification";
  data.unknowns = status === "requires_review" || status === "insufficient_data" ? data.unknowns : [];
  setUiOneStatus(data, status);
  data.criteria = data.criteria.map(criterion => {
    if (criterion.criterion_type === "business_activity" && status !== "fails_selected_methodology")
      return { ...criterion, result: "pass" as const, ratio: 0, numerator_value: 0, result_reason: "primary_permissible" };
    if (criterion.id === "debt" && status === "fails_selected_methodology")
      return { ...criterion, result: "fail" as const, ratio: 41.3, numerator_value: 919e9 * 0.413 };
    if (criterion.id === "income" && status === "passes_selected_methodology")
      return { ...criterion, result: "pass" as const, numerator_value: 4e9,
        ratio: 4e9 / 479e9 * 100, result_reason: "below_limit" };
    return criterion;
  });
  return data;
}
