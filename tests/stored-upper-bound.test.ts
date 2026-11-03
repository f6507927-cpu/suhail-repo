import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { financialFact, source } from "../src/db/schema/market";
import { boundScreeningFacts, storedBoundInputs } from "../src/lib/financial/screening-facts";
import { storedBalanceFacts, BOUND_CONTEXT } from "../src/ingest/sec/fsn/stored-bound";
import { unavailableBalanceSheet } from "../src/ingest/sec/fsn/balance-sheet";
import { fsnTargets } from "./fsn-fixture";
import { proposedV11IncomeCriterion } from "../src/lib/methodology/proposed-v1.1";
import { upperBoundFallback } from "../src/engine/upper-bound";
import type { EngineInput } from "../src/engine";
import type { Tx } from "../src/lib/auth/audit";

type Row = typeof financialFact.$inferSelect;
type Source = typeof source.$inferSelect;
export function evidenceFixture() {
  const target = structuredClone(fsnTargets[0]);
  target.mapped.period.source.is_demo = false;
  target.mapped.period.source.is_synthetic = false;
  target.mapped.period.source.production_blocked = false;
  const sheet = unavailableBalanceSheet(target, "fixture");
  for (const name of ["cash", "short_term", "long_term"] as const) {
    sheet.components[name] = { value: name === "cash" ? 100 : 0,
      state: name === "cash" ? "reported" : "not_on_balance_sheet",
      label: name === "cash" ? "reported" : "not on balance sheet", reason: null, tags: [], rows: [] };
  }
  const facts = storedBalanceFacts(target, sheet).map(f => ({
    ...f, company_id: "company", period_id: "period", origin: "sec_fsn",
    source_id: "document", protected_current: false, is_current: true,
  })) as unknown as Row[];
  facts.push({ line_item: "total_revenue", value: 1000, input_state: "reported", source_id: "revenue",
    as_of_date: sheet.fiscalEnd, period_id: "period" } as Row);
  const sources = ["document", "revenue"].map(id => ({ id, source_type: "regulatory_filing",
    source_url: sheet.filingLink, document_reference: sheet.accession,
    confidence_tier: "Verified", is_demo: false, is_synthetic: false, production_blocked: false })) as Source[];
  return { facts, sources, target, sheet };
}
describe("stored upper-bound inputs", () => {
  it("stores the component evidence and completeness, never prohibited income or a yield-derived amount", () => {
    const { target, sheet } = evidenceFixture(), facts = storedBalanceFacts(target, sheet);
    expect(facts).toHaveLength(4);
    expect(facts.map(f => f.line_item)).not.toContain("prohibited_income");
    expect(facts.find(f => f.line_item === BOUND_CONTEXT)?.value_text).toContain(sheet.accession);
    expect(facts.every(f => f.source?.confidence_tier === "Verified")).toBe(true);
  });
  it("prepares an eligible Estimated bound using stored evidence, with no network", () => {
    const { facts, sources } = evidenceFixture();
    const prepared = boundScreeningFacts(facts, sources);
    const upper = upperBoundFallback(proposedV11IncomeCriterion(), {
      facts: [...prepared, { lineItem: "total_revenue", value: 1000, inputState: "reported", confidenceTier: "Verified", sourceId: "revenue" }],
    } as EngineInput);
    expect(upper).toMatchObject({ bound: 6, passes: true });
    expect(upper?.evidence.tiers).toContain("Estimated");
    expect(upper?.trace).toContain("conservative assumption chosen by Suhail");
  });
  it.each(["revenue-value", "revenue-source", "period", "unknown-cash", "protected-income", "asset-change",
    "absent-context", "untrusted-document", "malformed-context", "negative-cash", "wrong-version"] as const)(
    "fails closed for %s", reason => {
      const { facts, sources } = evidenceFixture();
      if (reason === "revenue-value") facts[4].value = 999;
      if (reason === "revenue-source") sources[1].document_reference = "different accession";
      if (reason === "period") facts[4].period_id = "other";
      if (reason === "unknown-cash") facts[0].input_state = "unknown";
      if (reason === "protected-income") facts.push({ line_item: "prohibited_income", value: null, protected_current: true } as Row);
      if (reason === "asset-change") facts[0].value = 200;
      if (reason === "absent-context") facts.splice(3, 1);
      if (reason === "untrusted-document") sources[0].is_synthetic = true;
      if (reason === "malformed-context") facts[3].value_text = "{bad";
      if (reason === "negative-cash") facts[0].value = -1;
      if (reason === "wrong-version") facts[0].calculation_version = "old";
      expect(boundScreeningFacts(facts, sources).at(-1)?.value).toBe(0);
    });
  it("does not query additional sources for v1.0", async () => {
    expect(await storedBoundInputs({} as Tx, evidenceFixture().facts, false)).toEqual([]);
  });
  it("invalidates completeness when the next refresh is unavailable", () => {
    const { target } = evidenceFixture();
    const records = storedBalanceFacts(target, unavailableBalanceSheet(target, "archive not yet published"));
    expect(records.find(f => f.line_item === BOUND_CONTEXT)?.value).toBe(0);
    expect(records[0]).toMatchObject({ value: null, input_state: "unknown" });
  });
});
