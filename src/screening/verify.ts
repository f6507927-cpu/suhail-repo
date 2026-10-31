import "server-only";
import { eq } from "drizzle-orm";
import { dbApp } from "../db/app";
import { screeningRun } from "../db/schema/screening";
import { hash } from "../engine/canonical";
import { screen } from "../engine/screen";
import { SUPPORTED_ENGINE_VERSIONS } from "../engine/versions";
import type { Criterion, EngineInput, Fact, Segment, JsonObject, JsonValue } from "../engine/types";
import { requireFinancial } from "../lib/financial/persistence";
import { idSchema } from "../lib/financial/service";
import type { Difference, Verification } from "./contracts";
import type { Tx } from "../lib/auth/audit";

/** Only metadata omitted from D-89's payload gets neutral, non-evaluated placeholders. */
export function inputFromPayload(p: JsonObject): EngineInput {
  const rows = (value: JsonValue | undefined) => value as JsonObject[];
  return {
    securityId: p.security_id as string, asOf: p.as_of as string,
    engineVersion: p.engine_version as string, calculationVersion: p.calculation_version as string,
    stalenessLimitDays: p.staleness_limit_days as number,
    period: { id: p.financial_period_id as string, label: p.financial_period_label as string, periodEnd: p.financial_period_end as string },
    methodologyVersion: { id: p.methodology_version_id as string, label: p.methodology_version_label as string,
      criteria: rows(p.criteria).map(c => ({
        id: c.id, criterionType: c.criterion_type, label: c.label, numeratorDefinition: c.numerator_definition,
        denominatorDefinition: c.denominator_definition, numeratorLineItems: c.numerator_line_items,
        denominatorLineItems: c.denominator_line_items, threshold: c.threshold, thresholdUnit: c.threshold_unit,
        thresholdDirection: c.threshold_direction, borderlineMargin: c.borderline_margin,
        treatmentRuleData: c.treatment_rule_data, sourceReference: c.source_reference, sortOrder: c.sort_order,
        definition: "", formulaText: "", treatmentRules: "", edgeCases: "", requiredInputs: [],
        // Not an inferred evidence date: effectiveDate is validation-only and excluded from the hash.
        effectiveDate: "1970-01-01", notes: "",
      } as Criterion)) },
    facts: rows(p.facts).map(f => ({ lineItem: f.line_item, value: f.value, inputState: f.input_state,
      confidenceTier: f.confidence_tier, sourceId: f.source_id } as Fact)),
    segments: rows(p.segments).map(s => ({ segmentName: s.segment_name, activityCategory: s.activity_category,
      revenueAmount: s.revenue_amount, revenueShare: s.revenue_share, inputState: s.input_state,
      confidenceTier: s.confidence_tier, sourceId: s.source_id } as Segment)),
  };
}
export function diff(expected: JsonValue | undefined, actual: JsonValue | undefined, path = "$"): Difference[] {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return [];
  if (expected !== null && actual !== null && typeof expected === "object" && typeof actual === "object") {
    const e = expected as JsonObject, a = actual as JsonObject;
    return [...new Set([...Object.keys(e), ...Object.keys(a)])].sort()
      .flatMap(key => diff(e[key], a[key], `${path}.${key}`));
  }
  return [{ path, expected, actual }];
}
/** D-43: never consult current facts or mutable methodology rows during replay. */
export function verifyStoredRun(run: Pick<typeof screeningRun.$inferSelect, "hash_payload" | "immutable_hash">): Verification {
  const payload = run.hash_payload as JsonObject;
  const computedHash = hash(payload);
  const hashMatches = computedHash === run.immutable_hash;
  const differences: Difference[] = hashMatches ? [] : [{ path: "$.immutable_hash", expected: run.immutable_hash, actual: computedHash }];
  const engineVersion = payload.engine_version as string;
  // Replay only implemented engines, dispatching each under its own semantics.
  // Unsupported historical formats remain hash-verifiable without forced replay.
  if (typeof engineVersion === "string" && !SUPPORTED_ENGINE_VERSIONS.some(v => v === engineVersion)) {
    return { valid: hashMatches, hashMatches, replaySupported: false, replayMatches: null,
      engineVersion, storedHash: run.immutable_hash, computedHash, differences };
  }
  let replayMatches = false;
  try {
    const replay = screen(inputFromPayload(payload));
    const evidenceDiff = diff(payload, replay.hashPayload);
    differences.push(...evidenceDiff);
    replayMatches = evidenceDiff.length === 0;
  } catch (error) {
    differences.push({ path: "$.replay", expected: "Valid replayable engine input",
      actual: error instanceof Error ? error.message : "Engine replay failed" });
  }
  return { valid: hashMatches && replayMatches, hashMatches, replaySupported: true, replayMatches,
    engineVersion, storedHash: run.immutable_hash, computedHash, differences };
}
export async function verifyRun(runId: string, db: Pick<Tx, "select"> = dbApp): Promise<Verification> {
  const [run] = await db.select().from(screeningRun).where(eq(screeningRun.id, idSchema.parse(runId)));
  requireFinancial(run, "Screening run not found");
  return verifyStoredRun(run);
}
