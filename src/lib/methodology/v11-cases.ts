import { isDeepStrictEqual } from "node:util";
import type { AnalystCase } from "./contracts";
import { analystCasesSchema, criterionSchema } from "./contracts";
import { proposedV11Definition } from "./proposed-v1.1";
import { upperBoundPolicySchema } from "../../engine/upper-bound";

type Identity = { id: string; sort_order: number; criterion_type: string;
  numerator_line_items: string[]; denominator_line_items: string[] };

/** Copy expected outcomes, never regenerate them from the candidate engine. */
export function v11Cases(baseCases: unknown, baseCriteria: Identity[], criteria: Identity[]): AnalystCase[] {
  const identities = new Map(baseCriteria.map(old => {
    const matches = criteria.filter(c => c.sort_order === old.sort_order && c.criterion_type === old.criterion_type &&
      isDeepStrictEqual(c.numerator_line_items, old.numerator_line_items) &&
      isDeepStrictEqual(c.denominator_line_items, old.denominator_line_items));
    if (matches.length !== 1) throw new Error("Cannot uniquely match v1.0 analyst-case criterion to v1.1");
    return [old.id, matches[0].id];
  }));
  const copied = analystCasesSchema.parse(baseCases).map(test => ({
    ...structuredClone(test),
    expected: { ...test.expected, criteria: Object.fromEntries(Object.entries(test.expected.criteria).map(([id, result]) => {
      const mapped = identities.get(id);
      if (!mapped) throw new Error("v1.0 analyst case references an unmatched criterion");
      return [mapped, result];
    })) },
  }));
  const definition = proposedV11Definition();
  const incomeConfig = definition.criteria.find(c => c.key === "income")!;
  const income = criteria.find(c => c.sort_order === incomeConfig.sort_order && c.criterion_type === incomeConfig.criterion_type);
  if (!income) throw new Error("Missing v1.1 prohibited-income criterion");
  const policy = upperBoundPolicySchema.parse(criterionSchema.parse(
    Object.fromEntries(Object.entries(incomeConfig).filter(([key]) => key !== "key")),
  ).treatment_rule_data!.suhail_upper_bound);
  const scenarios = [
    { name: "upper bound below 5%", cash: 50, income: null, eligible: 1, result: "pass" },
    { name: "upper bound exactly 5%", cash: 100, income: null, eligible: 1, result: "pass" },
    { name: "reported income wins over favorable bound", cash: 50, income: 12, eligible: 1, result: "fail" },
    { name: "excessive bound remains unknown", cash: 200, income: null, eligible: 1, result: "unknown" },
    { name: "incomplete inputs remain unknown", cash: null, income: null, eligible: 0, result: "unknown" },
    { name: "analyst override wins over favorable bound", cash: 50, income: 12, eligible: 1, result: "fail", override: true },
    { name: "analyst zero override wins over excessive bound", cash: 200, income: 0, eligible: 1, result: "pass", override: true },
    { name: "protected analyst unknown refuses bound", cash: 50, income: null, eligible: 0, result: "unknown", override: true },
  ] as const;
  const added = scenarios.map(s => {
    const fact = (lineItem: string, value: number | null, override = false) => ({
      lineItem, value, inputState: value === null ? "unknown" : "reported",
      confidenceTier: "Verified", sourceId: override ? "synthetic-analyst-override" : "synthetic-v11-case",
    });
    return {
      name: `Suhail v1.1: ${s.name}`,
      inputs: {
        securityId: "synthetic-v11-security", asOf: "2026-10-19",
        period: { id: "synthetic-v11-period", label: "Synthetic annual analyst case", periodEnd: "2026-09-30" },
        facts: [
          fact("interest_bearing_debt", 0), fact("market_value_basis", 1000),
          fact("total_revenue", 120), fact("prohibited_income", s.income, "override" in s),
          fact(policy.cash_line_item, s.cash), fact(policy.short_term_line_item, 0),
          fact(policy.long_term_line_item, 0), fact(policy.eligibility_line_item, s.eligible),
        ],
        segments: [{ segmentName: "Synthetic permissible business", activityCategory: "technology",
          revenueAmount: 120, revenueShare: 1, inputState: "reported", confidenceTier: "Verified", sourceId: "synthetic-v11-case" }],
      },
      expected: {
        criteria: Object.fromEntries(criteria.map(c => [c.id, c.id === income.id ? s.result : "pass"])),
        status: s.result === "fail" ? "fails_selected_methodology" :
          s.result === "unknown" ? "requires_review" : "passes_selected_methodology",
      },
    };
  });
  return analystCasesSchema.parse([...copied, ...added]);
}

/** A stable name or identical inputs/outcomes identifies an already installed case.
 * Existing cases, including owner edits, always remain byte-for-byte intact.
 */
export function missingV11Cases(existing: AnalystCase[], candidates: AnalystCase[]) {
  const merged = structuredClone(existing);
  for (const candidate of candidates) {
    if (!merged.some(c => c.name === candidate.name ||
      (isDeepStrictEqual(c.inputs, candidate.inputs) && isDeepStrictEqual(c.expected, candidate.expected)))) merged.push(candidate);
  }
  return { cases: merged, added: merged.length - existing.length };
}
