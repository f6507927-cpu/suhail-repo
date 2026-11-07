import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { financialFact } from "../src/db/schema/market";
import { assetKeys, assetScreeningFacts, usesAssetKeys } from "../src/lib/financial/screening-facts";
import { newMethodologyDefinition } from "../src/lib/methodology/new-methodologies";
import { evidenceFixture } from "./stored-upper-bound.test";

type Row = typeof financialFact.$inferSelect;
const values = (facts: ReturnType<typeof assetScreeningFacts>) =>
  Object.fromEntries(facts.map(f => [f.lineItem, [f.value, f.inputState]]));

// D-171/D-172: balance-sheet inputs from the same validated filing context as D-155.
describe("asset screening facts", () => {
  it("passes validated cash and securities through under engine-only keys", () => {
    const { facts, sources } = evidenceFixture();
    const prepared = assetScreeningFacts(facts, sources);
    expect(prepared.map(f => f.lineItem)).toEqual(Object.values(assetKeys));
    expect(values(prepared)).toEqual({
      suhail_assets_cash: [100, "reported"],
      suhail_assets_short_term_securities: [0, expect.any(String)],
      suhail_assets_long_term_securities: [0, expect.any(String)],
    });
    expect(prepared.every(f => f.sourceId === "document")).toBe(true);
  });
  it("a protected income decision does not invalidate asset evidence", () => {
    const { facts, sources } = evidenceFixture();
    facts.push({ line_item: "prohibited_income", value: null, protected_current: true } as Row);
    expect(assetScreeningFacts(facts, sources)[0]).toMatchObject({ value: 100, inputState: "reported" });
  });
  it.each(["unknown-cash", "untrusted-document", "malformed-context", "absent-context", "wrong-version", "revenue-value"] as const)(
    "is unknown, never zero, for %s", reason => {
      const { facts, sources } = evidenceFixture();
      if (reason === "unknown-cash") facts[0].input_state = "unknown";
      if (reason === "untrusted-document") sources[0].is_synthetic = true;
      if (reason === "malformed-context") facts[3].value_text = "{bad";
      if (reason === "absent-context") facts.splice(3, 1);
      if (reason === "wrong-version") facts[0].calculation_version = "old";
      if (reason === "revenue-value") facts[4].value = 999;
      const prepared = assetScreeningFacts(facts, sources);
      expect(prepared).toHaveLength(3);
      expect(prepared.every(f => f.value === null && f.inputState === "unknown")).toBe(true);
    });
  it("is enabled only for methodologies that use the asset keys", () => {
    expect(usesAssetKeys(newMethodologyDefinition("aaoifi").criteria.map(c => c.data))).toBe(true);
    expect(usesAssetKeys(newMethodologyDefinition("msci").criteria.map(c => c.data))).toBe(true);
    expect(usesAssetKeys([{ numerator_line_items: ["interest_bearing_debt"], denominator_line_items: ["market_value_basis"] },
      { numeratorLineItems: ["prohibited_income"], denominatorLineItems: ["total_revenue"] }])).toBe(false);
  });
});
