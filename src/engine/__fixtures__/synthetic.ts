import type { Criterion, EngineInput, Fact, InputState, Segment } from "../types";
import { CALCULATION_VERSION, ENGINE_VERSION } from "../versions";

/** Fabricated §8 examples only. No real-company data or production governance. */
export const categoriesA = [
  "conventional_finance", "interest_based_lending", "insurance_conventional",
  "alcohol", "tobacco", "gambling", "adult_entertainment", "pork_related",
];
export const categoriesB = [...categoriesA, "conventional_media", "weapons_conventional"];
export function criterion(overrides: Partial<Criterion> = {}): Criterion {
  return {
    id: "fixture-ratio", criterionType: "custom_ratio", label: "Fixture ratio",
    definition: "Synthetic ratio", formulaText: "debt / assets",
    numeratorDefinition: "Interest-bearing debt", denominatorDefinition: "total assets",
    numeratorLineItems: ["interest_bearing_debt"], denominatorLineItems: ["total_assets"],
    threshold: 33, thresholdUnit: "percent_of_total_assets", thresholdDirection: "max",
    borderlineMargin: null, treatmentRules: "", treatmentRuleData: {}, edgeCases: "",
    requiredInputs: ["interest_bearing_debt", "total_assets"], sourceReference: "synthetic evidence",
    effectiveDate: "2026-01-01", sortOrder: 1, notes: "Demo only",
    ...overrides,
  };
}
export function fact(lineItem: string, value: number | null, inputState: InputState = "reported"): Fact {
  return { lineItem, value, inputState, confidenceTier: "Verified", sourceId: `fixture-source-${lineItem}` };
}
export function segment(overrides: Partial<Segment> = {}): Segment {
  return {
    segmentName: "Fixture technology", activityCategory: "technology",
    revenueAmount: 100, revenueShare: 1, inputState: "reported",
    confidenceTier: "Verified", sourceId: "fixture-source-segment",
    ...overrides,
  };
}
export function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    securityId: "fixture-alpha-security", asOf: "2026-10-11",
    engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION,
    methodologyVersion: { id: "fixture-version", label: "Fixture Alpha Co methodology", criteria: [criterion()] },
    period: { id: "fixture-period", label: "Fixture annual 2025", periodEnd: "2025-12-31" },
    facts: [fact("interest_bearing_debt", 12), fact("total_assets", 100)],
    segments: [segment()],
    ...overrides,
  };
}
export function exampleCriteria(example: "A" | "B"): Criterion[] {
  const a = example === "A";
  const categories = a ? categoriesA : categoriesB;
  return [
    criterion({
      id: "fixture-business", criterionType: "business_activity", label: "Business activity",
      threshold: null, thresholdUnit: "boolean", thresholdDirection: "boolean",
      numeratorLineItems: ["business_segments"], denominatorLineItems: [],
      numeratorDefinition: "Primary business activity", denominatorDefinition: "",
      treatmentRuleData: { prohibited_categories: categories }, requiredInputs: ["business_segments"],
    }),
    criterion({
      id: "fixture-nonpermissible", criterionType: "non_permissible_revenue",
      label: "Non-permissible revenue", threshold: a ? 5 : 3,
      thresholdUnit: "percent_of_total_revenue", borderlineMargin: a ? 0.5 : null,
      numeratorLineItems: ["business_segments"], denominatorLineItems: ["total_revenue"],
      numeratorDefinition: "Non-permissible segment revenue", denominatorDefinition: "total revenue",
      treatmentRuleData: { non_permissible_categories: categories }, sortOrder: 2,
    }),
    criterion({
      id: "fixture-debt", criterionType: "interest_bearing_debt", label: "Interest-bearing debt",
      threshold: a ? 33 : 25, borderlineMargin: a ? 3 : 2, sortOrder: 3,
      // D-44/D-62: EX-B's lease prose is NOT permission to silently add leases.
      treatmentRules: a ? "trade payables and non-finance-cost liabilities excluded" : "lease liabilities with a finance cost included",
    }),
    criterion({
      id: "fixture-cash", criterionType: "cash_and_investments", label: "Cash and investments",
      threshold: a ? 33 : 25, borderlineMargin: a ? 3 : 2,
      numeratorLineItems: a ? ["cash_and_equivalents", "interest_bearing_investments"] : ["cash_and_equivalents"],
      numeratorDefinition: a ? "Cash and interest-bearing investments" : "Cash",
      sortOrder: 4,
    }),
    criterion({
      id: "fixture-receivables", criterionType: "receivables", label: "Accounts receivable",
      threshold: a ? 45 : 40, numeratorLineItems: ["accounts_receivable"],
      numeratorDefinition: "Accounts receivable", sortOrder: 5,
    }),
  ];
}
export function goldenInput(example: "A" | "B", outcome: "pass" | "review" | "fail" | "insufficient"): EngineInput {
  const names = { pass: "Alpha", review: "Beta", fail: "Gamma", insufficient: "Delta" };
  return input({
    // Historical D-89 goldens are immutable regressions, not new-run defaults.
    engineVersion: "engine-1.0.1", calculationVersion: "calc-2026.10.1",
    securityId: `fixture-${names[outcome].toLowerCase()}-security`,
    methodologyVersion: { id: `fixture-EX-${example}`, label: `EX-${example} Demo only`, criteria: exampleCriteria(example) },
    period: { id: `fixture-${names[outcome].toLowerCase()}-period`, label: `Fixture ${names[outcome]} Co annual`, periodEnd: "2025-12-31" },
    facts: [
      fact("interest_bearing_debt", outcome === "fail" ? 80 : outcome === "review" ? (example === "A" ? 33 : 25) : 12),
      ...(outcome === "insufficient" ? [] : [fact("total_assets", 100)]),
      fact("total_revenue", 100), fact("cash_and_equivalents", 10),
      fact("interest_bearing_investments", 2), fact("accounts_receivable", 15),
      fact("finance_lease_liabilities", 200), fact("operating_lease_liabilities", 300),
    ],
    segments: [
      segment({ revenueAmount: 99, revenueShare: 0.99 }),
      segment({ segmentName: "Fixture secondary", activityCategory: "alcohol", revenueAmount: 1, revenueShare: 0.01 }),
    ],
  });
}
