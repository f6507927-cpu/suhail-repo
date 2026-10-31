import { describe, expect, it } from "vitest";
import { enumDisplayLabel, lineItemLabel, structuredKeyLabel, structuredValueLabel } from "./structured-labels";

describe("structured methodology display labels", () => {
  it("localizes known keys, line items, and enum values", () => {
    expect(structuredKeyLabel("input_state", "en")).toBe("Input state");
    expect(structuredValueLabel("input_state", "estimated", "en")).toBe("Estimated");
    expect(structuredValueLabel("workflow_status", "approved", "en")).toBe("Approved");
    expect(lineItemLabel("total_revenue", "en")).toBe("Total revenue");
    expect(enumDisplayLabel("methodType", "equity_screening", "ar")).toBe("فحص الأسهم");
    expect(enumDisplayLabel("criterionType", "interest_bearing_debt", "en")).toBe("Interest-bearing debt");
  });

  it("does not expose unknown machine keys and renders booleans as labels", () => {
    expect(structuredKeyLabel("unexpected_snake_key", "en")).toBe("Unrecognized label");
    expect(structuredValueLabel("enabled", true, "en")).toBe("Yes");
    expect(enumDisplayLabel("lineItem", "unexpected_line_item", "en")).toBe("Unrecognized label");
  });
});
