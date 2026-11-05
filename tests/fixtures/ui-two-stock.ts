import type { StockFact } from "../../src/stock/types";
import { uiOneFixture } from "./ui-one-stock";

/** Synthetic presentation fixture; not JPM/Apple or a claim about hosted data. */
export function uiTwoFixture() {
  const data = uiOneFixture();
  data.company.name = data.company.display_name_en = "UI-2 display fixture";
  data.run!.data_as_of = data.period!.period_end = "2025-12-31";
  data.period!.reported_date = "2026-11-04";
  data.run!.generated_at = new Date("2026-11-04T12:00:00Z");
  data.priorRuns = [{ ...data.run!, id: "prior", generated_at: new Date("2026-11-03T22:00:00Z") }];
  const fact = (line_item: string, value: number): StockFact => ({
    id: line_item, line_item, label: line_item, value, value_text: null, currency: "USD", unit_scale: "absolute",
    input_state: "reported", confidence_tier: "Verified", source_id: "source", unknown_note: null,
  });
  data.facts = [fact("market_cap", 879e9), fact("total_revenue", 80_111_000_000),
    fact("net_income", 31e9), fact("cash_and_equivalents", 42e9)];
  data.criteria.splice(1, 0, {
    ...data.criteria[1], id: "debt", criterion_id: "debt", criterion_type: "interest_bearing_debt",
    criterion_label: "Interest-bearing debt / market value basis", numerator_definition: "interest_bearing_debt",
    denominator_definition: "market_value_basis", numerator_value: 64.8e9, denominator_value: 919e9,
    threshold_unit: "percent_of_market_cap", result: "pass", ratio: 64.8 / 919 * 100, threshold: 30,
    result_reason: "below_limit", sort_order: 1,
  });
  data.storedClose = { id: "price", close: 344.63, currency: "USD", date: "2026-10-30",
    month_end_for: "2026-10-31", price_provider: "API Ninjas", source_id: "source",
    source_label: "API Ninjas", created_at: "2026-10-31" };
  return data;
}
