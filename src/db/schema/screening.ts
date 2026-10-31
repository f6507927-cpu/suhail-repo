import { text, uuid, jsonb, date, integer, index } from "drizzle-orm/pg-core";
import {
  appSchema,
  base,
  money,
  ratio,
  keys,
  ids,
  criterionType,
  thresholdUnit,
  thresholdDirection,
  confidenceTier,
  screeningStatus,
  validationStatus,
  inputState,
  time,
} from "./core";
import { historicalCreator } from "./accounts";
import { security, company, financialPeriod } from "./market";
import {
  methodology,
  methodologyVersion,
  methodologyCriterion,
} from "./methodology";
import type { JsonObject, StatusReason, HashPayload } from "./types";

export const dataAdequacy = appSchema.enum("data_adequacy", [
  "adequate",
  "adequate_with_estimates",
  "inadequate",
]);
export const confidence = appSchema.enum("confidence", [
  "High",
  "Medium",
  "Low",
]);
export const criterionResult = appSchema.enum("criterion_result", [
  "pass",
  "borderline",
  "fail",
  "unknown",
]);
export const unknownSeverity = appSchema.enum("unknown_severity", [
  "blocking",
  "review",
  "informational",
]);
export const screeningRun = appSchema.table("screening_run", {
  ...base(),
  created_by: historicalCreator(),
  security_id: uuid("security_id")
    .notNull()
    .references(() => security.id),
  company_id: uuid("company_id").references(() => company.id),
  exchange_code: text("exchange_code"),
  ticker: text("ticker"),
  company_name: text("company_name"),
  methodology_id: uuid("methodology_id").references(() => methodology.id),
  methodology_name: text("methodology_name"),
  methodology_version_id: uuid("methodology_version_id")
    .notNull()
    .references(() => methodologyVersion.id),
  methodology_version_label: text("methodology_version_label"),
  financial_period_id: uuid("financial_period_id").references(
    () => financialPeriod.id,
  ),
  financial_period_label: text("financial_period_label"),
  // §7.4: synthetic snap_{periodId}_{hashPrefix}, not a relational identifier.
  financial_snapshot_id: text("financial_snapshot_id"),
  calculation_version: text("calculation_version"),
  data_adequacy: dataAdequacy("data_adequacy").notNull().default("adequate"),
  confidence: confidence("confidence"),
  status: screeningStatus("status").notNull(),
  status_reasons: jsonb("status_reasons")
    .$type<StatusReason[]>()
    .notNull()
    .default([]),
  hash_payload: jsonb("hash_payload").$type<HashPayload>().notNull(),
  data_as_of: date("data_as_of"),
  generated_at: time("generated_at").notNull().defaultNow(),
  immutable_hash: text("immutable_hash").notNull(),
  engine_version: text("engine_version"),
});
export const screeningCriterionResult = appSchema.table(
  "screening_criterion_result",
  {
    ...base(),
    created_by: historicalCreator(),
    screening_run_id: uuid("screening_run_id")
      .notNull()
      .references(() => screeningRun.id),
    criterion_id: uuid("criterion_id").references(
      () => methodologyCriterion.id,
    ),
    criterion_type: criterionType("criterion_type").notNull(),
    criterion_label: text("criterion_label"),
    result: criterionResult("result").notNull(),
    numerator_value: money("numerator_value"),
    numerator_definition: text("numerator_definition"),
    denominator_value: money("denominator_value"),
    denominator_definition: text("denominator_definition"),
    ratio: ratio("ratio"),
    threshold: ratio("threshold"),
    threshold_unit: thresholdUnit("threshold_unit"),
    threshold_direction: thresholdDirection("threshold_direction"),
    borderline_margin: ratio("borderline_margin"),
    input_states: inputState("input_states").array().notNull().default([]),
    confidence_tier: confidenceTier("confidence_tier"),
    source_ids: ids("source_ids"),
    calculation_trace: text("calculation_trace"),
    result_reason: text("result_reason"),
    source_reference: text("source_reference"),
    sort_order: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("screening_criterion_result_sources_gin").using("gin", t.source_ids),
  ],
);
export const screeningUnknown = appSchema.table("screening_unknown", {
  ...base(),
  created_by: historicalCreator(),
  screening_run_id: uuid("screening_run_id")
    .notNull()
    .references(() => screeningRun.id),
  criterion_id: uuid("criterion_id").references(() => methodologyCriterion.id),
  criterion_type: criterionType("criterion_type"),
  criterion_label: text("criterion_label"),
  field_or_input: text("field_or_input").notNull(),
  why_missing: text("why_missing"),
  effect: text("effect"),
  source_reference: text("source_reference"),
  severity: unknownSeverity("severity").notNull().default("review"),
});
export const explanationObject = appSchema.table("explanation_object", {
  ...base(),
  created_by: historicalCreator(),
  screening_run_id: uuid("screening_run_id")
    .notNull()
    .references(() => screeningRun.id),
  security_id: uuid("security_id").references(() => security.id),
  methodology_version_label: text("methodology_version_label"),
  claim: text("claim"),
  evidence: jsonb("evidence").$type<JsonObject[]>(),
  unknowns: jsonb("unknowns").$type<JsonObject[]>(),
  sources: jsonb("sources").$type<JsonObject[]>(),
  methodology: jsonb("methodology").$type<JsonObject>(),
  allowed_numbers: keys("allowed_numbers"),
  allowed_tokens: keys("allowed_tokens"),
  ai_text: text("ai_text"),
  ai_model: text("ai_model"),
  prompt_version: text("prompt_version"),
  validation_status: validationStatus("validation_status")
    .notNull()
    .default("not_run"),
  validation_details: keys("validation_details"),
  generated_at: time("generated_at"),
});
