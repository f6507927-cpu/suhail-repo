import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("src/components/financial/FinancialAdmin.tsx", "utf8");
const securitiesPage = readFileSync("src/app/[locale]/(private)/admin/(protected)/securities/page.tsx", "utf8");
const ingestionPage = readFileSync("src/app/[locale]/(private)/admin/(protected)/ingestion/page.tsx", "utf8");

describe("financial admin UI wiring", () => {
  it("loads protected data through the authorized server pages", () => {
    for (const page of [securitiesPage, ingestionPage]) {
      expect(page).toContain('await requireRole(["admin", "editor"])');
      expect(page).toContain("getFinancialAdminData()");
      expect(page).toContain("getScreeningAdminData()");
      expect(page).toContain("Promise.all([getFinancialAdminData(), getScreeningAdminData()])");
      expect(page).toContain("context.user.role");
      const guardIndex = page.indexOf('await requireRole(["admin", "editor"])');
      expect(guardIndex).toBeLessThan(page.indexOf("getFinancialAdminData()"));
      expect(guardIndex).toBeLessThan(page.indexOf("getScreeningAdminData()"));
    }
  });

  it("exposes the financial review workflows through the shared action", () => {
    expect(component).toContain('from "@/app/[locale]/(private)/admin/(protected)/financial-actions"');
    for (const operation of ["lookup", "add", "ingest", "accept", "segment", "deleteSegment", "price", "coverage", "company", "remove", "runJob", "resumeJob"]) {
      expect(component).toContain(`operation: "${operation}"`);
    }
    expect(component).toContain('operation: mode');
    expect(component).toContain('"override"');
    expect(component).toContain('"confirm"');
    expect(component).toContain('data: { confirm: true }');
    expect(component).toContain('aria-labelledby="remove-title"');
  });

  it("sends the backend contract payloads from each editor form", () => {
    for (const field of [
      "data: { ticker }", "securityId: error.securityId as string", "data: { id: job.id }",
      "factId: fact.id", "reason: String(form.get(\"reason\")", "input_state: String(form.get(\"input_state\")",
      "confidence_tier: String(form.get(\"confidence_tier\")", "factId: alt.id", "segment_name: String(form.get(\"segment_name\"))",
      "data: { id: segment.id }", "date: String(form.get(\"date\"))", "analystId }",
      "name_ar: String(form.get(\"name_ar\")", "data: { confirm: true }", "operation: \"runJob\"",
    ]) expect(component).toContain(field);
    expect(component).toContain('operation: "company"');
    expect(component).toContain('operation: "price"');
    expect(component).toContain('operation: "coverage"');
  });

  it("keeps editors read-only and provides accessible feedback and source provenance", () => {
    expect(component).toContain('const canEdit = role === "admin"');
    expect(component).toContain('disabled={pending || !canEdit}');
    expect(component).toContain('disabled={!canEdit || pending || !selected.in_universe}');
    expect(component).toContain('{canEdit && <button');
    expect(component).toContain('role="status"');
    expect(component).toContain('role="alert"');
    expect(component).toContain("sec_changed");
    expect(component).toContain("source_url");
    expect(component).toContain("Shares outstanding are unknown or missing.");
  });

  it("scopes company facts to shared facts and the selected security", () => {
    expect(component).toContain('security_id?: string | null');
    expect(component).toContain('security_id === selected?.id');
    expect(component).toContain('security_id === security.id');
  });

  it("supports only sourced prohibited-income entry and bounded overrides", () => {
    expect(component).toContain('fact.line_item === "prohibited_income"');
    expect(component).toContain('!hasProhibitedIncome');
    expect(component).toContain('operation: "addProhibitedIncome"');
    for (const payloadField of ["periodId: period.id", "period_start: period.period_start", "period_end: period.period_end", "source_type: sourceType", "reason: String(form.get(\"reason\")"]) {
      expect(component).toContain(payloadField);
    }
    expect(component).toContain('prohibitedState === "reported" ? "Verified"');
    expect(component).toContain('prohibitedState === "reported" ? "Verified" : "Estimated"');
    expect(component).toContain('prohibitedState === "unknown" ? null');
    expect(component).toContain('fact.line_item !== "market_value_basis"');
  });

  it("submits explicit month-end attestations and shows quarter guidance without inference", () => {
    expect(component).toContain('import { completedQuarter, deriveMarketValue, selectMonthEnd } from "@/lib/financial/market-value"');
    expect(component).toContain('completedQuarter(guidanceAsOf)');
    expect(component).toContain('month_end_for: monthEndFor');
    expect(component).toContain('selectMonthEnd(prices, monthEnd)');
    expect(component).toContain('deriveMarketValue(guidanceAsOf, prices, shares, equity).value');
    expect(component).toContain('fact.line_item === "total_equity"');
    expect(component).toContain("The close date is its actual last trading day; do not infer an attribution.");
    expect(component).toContain("Month-end representation must be the calendar month-end in the same month as the close date.");
  });
});
