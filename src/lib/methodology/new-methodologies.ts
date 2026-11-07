import aaoifi from "../../../data/methodologies/aaoifi-ss21-adapted-1.0.json";
import msci from "../../../data/methodologies/msci-islamic-adapted-1.0.json";
import type { AnalystCase, CriterionData } from "./contracts";
import { analystCasesSchema, criterionSchema, metadataSchema, versionSchema } from "./contracts";

/** D-171/D-172: committed, reviewable definitions; no DB, approval or activation. */
export type NewMethodologyKey = "aaoifi" | "msci";
type Raw = typeof aaoifi | typeof msci;
export function newMethodologyDefinition(key: NewMethodologyKey) {
  const raw: Raw = structuredClone(key === "aaoifi" ? aaoifi : msci);
  return {
    key, decision: raw.decision,
    metadata: metadataSchema.parse(raw.metadata),
    version: versionSchema.parse(raw.version),
    document: raw.document,
    criteria: raw.criteria.map(({ key: criterionKey, ...data }) => ({ key: criterionKey, data: criterionSchema.parse(data) })),
    notApplied: raw.not_applied, reviewerQuestions: raw.reviewer_questions,
  };
}
export type NewMethodologyDefinition = ReturnType<typeof newMethodologyDefinition>;

type Value = number | null;
type Scenario = {
  name: string;
  facts?: Record<string, Value>;
  segments?: { category: string; amount: number }[];
  /** Hand-declared outcomes for the varied criteria; every other criterion is "pass". */
  expected: Record<string, "pass" | "fail" | "unknown">;
  status: AnalystCase["expected"]["status"];
};
const tech = [{ category: "technology", amount: 1000 }];
// Base inputs pass every criterion. Expectations are declared by hand below and
// verified by the normal test report; they are never derived from the engine.
const baseFacts: Record<NewMethodologyKey, Record<string, Value>> = {
  aaoifi: {
    interest_bearing_debt: 100, market_cap: 1000, total_revenue: 1000, prohibited_income: 10,
    suhail_assets_cash: 50, suhail_assets_short_term_securities: 0, suhail_assets_long_term_securities: 0,
    suhail_bound_cash: 50, suhail_bound_short_term_securities: 0, suhail_bound_long_term_securities: 0, suhail_bound_eligible: 1,
  },
  msci: {
    interest_bearing_debt: 1000, finance_lease_liabilities: 0, total_assets: 10000, total_revenue: 1000,
    prohibited_income: 10, accounts_receivable: 1000, cash_and_equivalents: 1000,
    suhail_assets_cash: 1000, suhail_assets_short_term_securities: 0, suhail_assets_long_term_securities: 0,
  },
};
const edges = (key: string, line: string, below: number, at: number, above: number, label: string, extra: Record<string, Value> = {}): Scenario[] => [
  { name: `${label} just below the limit`, facts: { ...extra, [line]: below }, expected: { [key]: "pass" }, status: "passes_selected_methodology" },
  { name: `${label} exactly at the limit passes`, facts: { ...extra, [line]: at }, expected: { [key]: "pass" }, status: "passes_selected_methodology" },
  { name: `${label} just above the limit fails`, facts: { ...extra, [line]: above }, expected: { [key]: "fail" }, status: "fails_selected_methodology" },
  { name: `${label} unknown numerator`, facts: { ...extra, [line]: null }, expected: { [key]: "unknown" }, status: "requires_review" },
];
const scenarios: Record<NewMethodologyKey, Scenario[]> = {
  aaoifi: [
    { name: "all criteria pass", expected: {}, status: "passes_selected_methodology" },
    { name: "prohibited primary activity fails", segments: [{ category: "conventional_finance", amount: 1000 }], expected: { primary_activity: "fail" }, status: "fails_selected_methodology" },
    { name: "unclassified primary activity is unknown", segments: [{ category: "unclassified", amount: 1000 }], expected: { primary_activity: "unknown" }, status: "requires_review" },
    ...edges("debt", "interest_bearing_debt", 299, 300, 301, "Debt 30% of market cap"),
    ...edges("deposits", "suhail_assets_cash", 299, 300, 301, "Deposits and investments 30% of market cap"),
    { name: "short- and long-term investments count toward deposits", facts: { suhail_assets_cash: 100, suhail_assets_short_term_securities: 100, suhail_assets_long_term_securities: 101 }, expected: { deposits: "fail" }, status: "fails_selected_methodology" },
    ...edges("income", "prohibited_income", 49, 50, 51, "Prohibited income 5% of revenue", { suhail_bound_eligible: 0 }),
    { name: "upper bound exactly 5% passes when income is unreported", facts: { prohibited_income: null, total_revenue: 120, suhail_bound_cash: 100 }, expected: { income: "pass" }, status: "passes_selected_methodology" },
    { name: "excessive upper bound remains unknown", facts: { prohibited_income: null, total_revenue: 120, suhail_bound_cash: 200 }, expected: { income: "unknown" }, status: "requires_review" },
    { name: "reported income wins over a favourable bound", facts: { prohibited_income: 60 }, expected: { income: "fail" }, status: "fails_selected_methodology" },
  ],
  msci: [
    { name: "all criteria pass", expected: {}, status: "passes_selected_methodology" },
    { name: "excluded primary activity fails both business criteria", segments: [{ category: "hotels", amount: 1000 }], expected: { primary_activity: "fail", revenue: "fail" }, status: "fails_selected_methodology" },
    { name: "unclassified primary activity is unknown", segments: [{ category: "unclassified", amount: 1000 }], expected: { primary_activity: "unknown", revenue: "unknown" }, status: "requires_review" },
    { name: "excluded music segment counts with interest income", segments: [{ category: "music", amount: 30 }, { category: "technology", amount: 970 }], facts: { prohibited_income: 21 }, expected: { revenue: "fail" }, status: "fails_selected_methodology" },
    { name: "cinema segment plus interest exactly at 5% passes", segments: [{ category: "cinema", amount: 30 }, { category: "technology", amount: 970 }], facts: { prohibited_income: 20 }, expected: { revenue: "pass" }, status: "passes_selected_methodology" },
    ...edges("revenue", "prohibited_income", 49, 50, 51, "Excluded revenue and interest 5%"),
    ...edges("debt", "interest_bearing_debt", 3332, 3333, 3334, "Total debt 33.33% of assets"),
    { name: "finance leases count toward total debt", facts: { interest_bearing_debt: 3000, finance_lease_liabilities: 334 }, expected: { debt: "fail" }, status: "fails_selected_methodology" },
    { name: "absent finance lease line is unknown, not zero", facts: { finance_lease_liabilities: null }, expected: { debt: "unknown" }, status: "requires_review" },
    ...edges("cash", "suhail_assets_cash", 3332, 3333, 3334, "Cash and securities 33.33% of assets"),
    ...edges("receivables", "accounts_receivable", 5999, 6000, 6001, "Receivables and cash 70% of assets"),
  ],
};
/** Builds analyst cases against the given criterion UUIDs (installed or planned). */
export function newMethodologyCases(definition: NewMethodologyDefinition, ids: Record<string, string>): AnalystCase[] {
  return analystCasesSchema.parse(scenarios[definition.key].map(s => {
    const facts = { ...baseFacts[definition.key], ...s.facts };
    const segments = s.segments ?? tech;
    return {
      name: `${definition.metadata.short_label}: ${s.name}`,
      inputs: {
        securityId: `synthetic-${definition.key}-security`, asOf: "2026-11-07",
        period: { id: `synthetic-${definition.key}-period`, label: "Synthetic annual analyst case", periodEnd: "2026-09-30" },
        facts: Object.entries(facts).map(([lineItem, value]) => ({
          lineItem, value, inputState: value === null ? "unknown" : "reported",
          confidenceTier: "Verified", sourceId: `synthetic-${definition.key}-case`,
        })),
        segments: segments.map(segment => ({
          segmentName: `Synthetic ${segment.category}`, activityCategory: segment.category,
          revenueAmount: segment.amount, revenueShare: null, inputState: "reported",
          confidenceTier: "Verified", sourceId: `synthetic-${definition.key}-case`,
        })),
      },
      expected: {
        criteria: Object.fromEntries(definition.criteria.map(c => [ids[c.key], s.expected[c.key] ?? "pass"])),
        status: s.status,
      },
    };
  }));
}
export function plannedIds(definition: NewMethodologyDefinition) {
  return Object.fromEntries(definition.criteria.map((c, i) =>
    [c.key, `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]));
}
export type { CriterionData };
