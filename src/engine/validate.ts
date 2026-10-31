import { z } from "zod";
import type { EngineInput, JsonValue } from "./types";
import { EngineInputError } from "./errors";
export { EngineInputError } from "./errors";
import { SUPPORTED_ENGINE_VERSIONS, SUPPORTED_CALCULATION_VERSIONS } from "./versions";
import { validateShares } from "./shares";
const states = z.enum(["reported", "derived", "estimated", "unknown"]);
const tiers = z.enum(["Verified", "Calculated", "Estimated", "AI Interpretation"]);
const categories = [
  "conventional_finance", "interest_based_lending", "insurance_conventional",
  "alcohol", "tobacco", "gambling", "adult_entertainment", "pork_related",
  "conventional_media", "weapons_conventional", "generic_permissible",
  "real_estate_permissible", "technology", "healthcare", "retail_permissible",
  "industrials", "energy", "telecom", "unclassified",
] as const;
export const ratioTypes = ["interest_bearing_debt", "cash_and_investments", "receivables", "custom_ratio"];

// Existing Zod validates the entire required contract, including runtime callers.
// Parsing only validates; screen keeps the original input without mutation.
const numeric = z.number().finite().nullable();
const json: z.ZodType<JsonValue | undefined> = z.lazy(() => z.union([
  z.string(), z.boolean(), z.number().finite(), z.null(), z.undefined(),
  z.array(json), z.record(z.string(), json),
]));
const categoryList = z.array(z.enum(categories));
const contract = z.object({
  securityId: z.string(), asOf: z.string(),
  stalenessLimitDays: z.number().finite().int().positive().optional(),
    engineVersion: z.enum(SUPPORTED_ENGINE_VERSIONS), calculationVersion: z.enum(SUPPORTED_CALCULATION_VERSIONS),
  period: z.object({ id: z.string(), label: z.string(), periodEnd: z.string() }),
  facts: z.array(z.object({
    lineItem: z.string(), value: numeric, inputState: states, confidenceTier: tiers, sourceId: z.string(),
  })),
  segments: z.array(z.object({
    segmentName: z.string(), activityCategory: z.enum(categories),
     revenueAmount: numeric, revenueShare: z.number().finite().min(0).max(1).nullable(), inputState: states, confidenceTier: tiers, sourceId: z.string(),
  })),
  methodologyVersion: z.object({
    id: z.string(), label: z.string(),
    criteria: z.array(z.object({
      id: z.string(), criterionType: z.string(), label: z.string(),
      definition: z.string(), formulaText: z.string(), numeratorDefinition: z.string(), denominatorDefinition: z.string(),
      numeratorLineItems: z.array(z.string()), denominatorLineItems: z.array(z.string()),
      threshold: numeric, borderlineMargin: z.number().finite().min(0).nullable(),
      thresholdDirection: z.enum(["max", "min", "boolean"]),
      thresholdUnit: z.enum(["percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap", "boolean", "absolute"]),
      treatmentRules: z.string(), treatmentRuleData: z.record(z.string(), json),
      edgeCases: z.string(), requiredInputs: z.array(z.string()), sourceReference: z.string(),
      effectiveDate: z.string(), sortOrder: z.number().finite(), notes: z.string(),
    })).min(1),
  }),
});
function unique(values: string[], field: string) {
  if (new Set(values).size !== values.length) throw new EngineInputError(field, "duplicate evidence key");
}
export function dateMillis(value: string, field: string): number {
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(millis) ||
      new Date(millis).toISOString().slice(0, 10) !== value) {
    throw new EngineInputError(field, "expected a valid YYYY-MM-DD date");
  }
  return millis;
}

export function validate(input: EngineInput): void {
  const parsed = contract.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new EngineInputError(issue.path.join("."), issue.message); // D-83
  }
  dateMillis(input.asOf, "asOf");
  dateMillis(input.period.periodEnd, "period.periodEnd");
  unique(input.facts.map((f) => f.lineItem), "facts.lineItem");
  unique(input.segments.map((s) => s.segmentName), "segments.segmentName");
  unique(input.methodologyVersion.criteria.map((c) => c.id), "criteria.id");
  validateShares(input.segments);
  for (const f of input.facts) {
    // D-88: ingestion must flag absent values as unknown, not reported/derived/estimated.
    if (f.value === null && f.inputState !== "unknown") throw new EngineInputError("fact.value", "null value requires unknown inputState");
  }
  for (const c of input.methodologyVersion.criteria) {
    dateMillis(c.effectiveDate, "criterion.effectiveDate");
    const categoryKey = c.criterionType === "business_activity" ? "prohibited_categories"
      : c.criterionType === "non_permissible_revenue" ? "non_permissible_categories" : null;
    if (categoryKey !== null && !categoryList.safeParse(c.treatmentRuleData[categoryKey]).success) {
      throw new EngineInputError(`criterion.treatmentRuleData.${categoryKey}`, "expected a category list");
    }
    if (ratioTypes.includes(c.criterionType) &&
        (c.numeratorLineItems.length === 0 || c.denominatorLineItems.length === 0)) {
      throw new EngineInputError("criterion.lineItems", "ratio numerator and denominator lists must be nonempty"); // D-86
    }
  }
}
