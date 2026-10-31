import "server-only";
import { and, eq, asc, desc, sql } from "drizzle-orm";
import { methodology, methodologyVersion, methodologyCriterion } from "../db/schema/methodology";
import { financialFact, businessSegment, exchange } from "../db/schema/market";
import { screeningRun, screeningCriterionResult, screeningUnknown } from "../db/schema/screening";
import type { HashPayload } from "../db/schema/types";
import { screen } from "../engine/screen";
import { ENGINE_VERSION } from "../engine/versions";
import type { Criterion, EngineInput } from "../engine/types";
import { jobMutation, type Mutation } from "../ingest/sec/ingest";
import { SEC_CALCULATION_VERSION } from "../ingest/sec/mapping";
import { audit } from "../lib/auth/audit";
import { securityContext, requireFinancial } from "../lib/financial/persistence";
import { idSchema } from "../lib/financial/service";
import { refreshMarketValue, securityFacts } from "../lib/financial/market-value-persistence";
import type { ScreenOptions, ScreenResult } from "./contracts";

/** Local integration tests use example fixtures; never a live SITE_MODE bypass. */
export function isExample(m: typeof methodology.$inferSelect, v: typeof methodologyVersion.$inferSelect) {
  return m.is_demo || v.is_demo || m.production_blocked || v.production_blocked ||
    m.official_or_inspired === "internal_example";
}
export function criterionInput(row: typeof methodologyCriterion.$inferSelect, versionDate: string | null): Criterion {
  const effectiveDate = row.effective_date ?? versionDate;
  requireFinancial(effectiveDate, "Methodology criterion effective date is missing");
  return {
    id: row.id, criterionType: row.criterion_type, label: row.label,
    definition: row.definition ?? "", formulaText: row.formula_text ?? "",
    numeratorDefinition: row.numerator_definition ?? "", denominatorDefinition: row.denominator_definition ?? "",
    numeratorLineItems: row.numerator_line_items, denominatorLineItems: row.denominator_line_items,
    threshold: row.threshold, thresholdUnit: row.threshold_unit, thresholdDirection: row.threshold_direction,
    borderlineMargin: row.borderline_margin, treatmentRules: row.treatment_rules ?? "",
    treatmentRuleData: row.treatment_rule_data ?? {}, edgeCases: row.edge_cases ?? "",
    requiredInputs: row.required_inputs, sourceReference: row.source_reference ?? "",
    effectiveDate, sortOrder: row.sort_order, notes: row.notes ?? "",
  };
}

/** D-23/D-42/D-43. Caller owns the clock; all evidence and inserts share one transaction. */
export async function screenSecurity(
  securityId: string, methodologyVersionId: string, options: ScreenOptions, mutate: Mutation = jobMutation,
): Promise<ScreenResult> {
  return mutate(async (tx, actor) => {
    // Match the issuer lock used by fact writes; serialize latest-run comparison.
    const { s, c, period } = await securityContext(tx, idSchema.parse(securityId));
    requireFinancial(period?.period_end, "No financial period to screen");
    const [version] = await tx.select().from(methodologyVersion)
      .where(eq(methodologyVersion.id, idSchema.parse(methodologyVersionId)));
    requireFinancial(version, "Methodology version not found");
    const [method] = await tx.select().from(methodology).where(eq(methodology.id, version.methodology_id));
    requireFinancial(method, "Methodology not found");
    // D-120: explicit preview seed only; never permit examples for real issuers.
    const demoSeed = options.trigger === "demo-seed" && process.env.SITE_MODE === "preview" &&
      s.is_demo && c.is_demo && method.is_demo && version.is_demo;
    requireFinancial(process.env.NODE_ENV === "test" || demoSeed || !isExample(method, version),
      "Demo and example methodologies cannot screen live securities");
    const criteria = await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id, version.id))
      .orderBy(asc(methodologyCriterion.sort_order), asc(methodologyCriterion.id));
    await refreshMarketValue(tx, actor, c.id, s.id, options.asOf);
    const facts = await tx.select().from(financialFact).where(and(eq(financialFact.company_id, c.id),
      eq(financialFact.period_id, period.id), eq(financialFact.is_current, true), securityFacts(s.id)));
    const segments = await tx.select().from(businessSegment).where(and(eq(businessSegment.company_id, c.id),
      eq(businessSegment.period_id, period.id)));
    requireFinancial(!facts.some(f => f.input_state === "missing" && f.value !== null), "Missing fact cannot contain a value");
    const input: EngineInput = {
      securityId: s.id, asOf: options.asOf, engineVersion: ENGINE_VERSION, calculationVersion: SEC_CALCULATION_VERSION,
      methodologyVersion: { id: version.id, label: version.version_label ?? version.version, criteria: criteria.map(r => criterionInput(r, version.effective_date)) },
      period: { id: period.id, label: period.fiscal_period_label, periodEnd: period.period_end },
      // Omission is the engine's "missing"; null rows remain explicitly unknown.
      facts: facts.flatMap(f => f.input_state === "missing" ? [] : [{ lineItem: f.line_item, value: f.value, inputState: f.input_state,
        confidenceTier: f.confidence_tier, sourceId: f.source_id ?? "" }]),
      segments: segments.map(s => {
        requireFinancial(s.input_state !== "missing", "Segment evidence state is invalid");
        return { segmentName: s.segment_name, activityCategory: s.activity_category,
        revenueAmount: s.revenue_amount, revenueShare: s.revenue_share, inputState: s.input_state,
        confidenceTier: s.confidence_tier, sourceId: s.source_id ?? "" };
      }),
    };
    const output = screen(input);
    const [previous] = await tx.select().from(screeningRun).where(and(eq(screeningRun.security_id, s.id),
      eq(screeningRun.methodology_version_id, version.id))).orderBy(desc(screeningRun.generated_at), desc(screeningRun.created_at), desc(screeningRun.id)).limit(1);
    if (previous?.immutable_hash === output.immutableHash) return { unchanged: true, runId: previous.id };
    const listingExchange = s.exchange_id
      ? (await tx.select().from(exchange).where(eq(exchange.id, s.exchange_id)))[0] : undefined;
    const isDemo = s.is_demo || c.is_demo || method.is_demo || version.is_demo;
    const [run] = await tx.insert(screeningRun).values({
      created_by: actor?.id, is_demo: isDemo, security_id: s.id, company_id: c.id,
      exchange_code: listingExchange?.code, ticker: s.ticker, company_name: c.name,
      methodology_id: method.id, methodology_name: method.name, methodology_version_id: version.id,
      methodology_version_label: input.methodologyVersion.label, financial_period_id: period.id,
      financial_period_label: period.fiscal_period_label, financial_snapshot_id: output.financialSnapshotId,
      calculation_version: input.calculationVersion, data_adequacy: output.dataAdequacy,
      confidence: output.confidence, status: output.status, status_reasons: output.statusReasons.map(r => ({
        kind: r.kind, criterion_id: r.criterionId, criterion_label: r.label, ratio: r.ratio, threshold: r.threshold,
        threshold_unit: r.thresholdUnit, reason_code: r.reasonCode, field: r.field,
        ...(r.borderlineCount === undefined ? {} : { borderline_count: r.borderlineCount }),
        ...(r.unknownCount === undefined ? {} : { unknown_count: r.unknownCount }),
      })),
      hash_payload: output.hashPayload as HashPayload, data_as_of: period.period_end,
      immutable_hash: output.immutableHash, engine_version: input.engineVersion,
      generated_at: sql`clock_timestamp()`,
    }).returning();
    if (output.criteria.length) await tx.insert(screeningCriterionResult).values(output.criteria.map(r => ({
      created_by: actor?.id, is_demo: isDemo, screening_run_id: run.id, criterion_id: r.criterionId,
      criterion_type: r.criterionType as typeof methodologyCriterion.$inferSelect["criterion_type"],
      criterion_label: r.label, result: r.result, numerator_value: r.numeratorValue,
      numerator_definition: r.numeratorDefinition, denominator_value: r.denominatorValue,
      denominator_definition: r.denominatorDefinition, ratio: r.ratio, threshold: r.threshold,
      threshold_unit: r.thresholdUnit, threshold_direction: r.thresholdDirection, borderline_margin: r.borderlineMargin,
      input_states: r.inputStates,
      confidence_tier: r.confidenceTier, source_ids: r.sourceIds, calculation_trace: r.calculationTrace,
      result_reason: r.resultReasonCode, source_reference: r.sourceReference, sort_order: r.sortOrder,
    })));
    if (output.unknowns.length) await tx.insert(screeningUnknown).values(output.unknowns.map(u => ({
      created_by: actor?.id, is_demo: isDemo, screening_run_id: run.id, criterion_id: u.criterionId,
      criterion_type: criteria.find(c => c.id === u.criterionId)?.criterion_type,
      criterion_label: u.label, field_or_input: u.field, why_missing: u.explanation,
      effect: u.severity, source_reference: criteria.find(c => c.id === u.criterionId)?.source_reference,
      severity: u.severity,
    })));
    await audit(tx, actor, { event_type: "screening_run", entity_name: "screening_run", entity_id: run.id,
      summary: "Screening run recorded", details: { trigger: options.trigger, asOf: options.asOf, immutableHash: output.immutableHash } });
    return { unchanged: false, runId: run.id };
  });
}
