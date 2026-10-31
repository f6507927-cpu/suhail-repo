import {
  boolean,
  text,
  uuid,
  jsonb,
  date,
  integer,
  unique,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  appSchema,
  base,
  ratio,
  keys,
  ids,
  criterionType,
  thresholdUnit,
  thresholdDirection,
  workflowStatus,
  time,
} from "./core";
import { mutableCreator, historicalCreator, auditEvent } from "./accounts";
import type {
  JsonObject,
  WorkflowEntry,
  TreatmentRuleData,
  PurificationTreatment,
} from "./types";

export const methodologyType = appSchema.enum("methodology_type", [
  "equity_screening",
  "fund_screening",
  "portfolio_screening",
]);
export const officialOrInspired = appSchema.enum("official_or_inspired", [
  "official",
  "adapted",
  "internal_example",
]);
export const licensingStatus = appSchema.enum("licensing_status", [
  "licensed",
  "public_document",
  "unlicensed_adapted",
  "internal",
  "unknown",
]);
export const methodology = appSchema.table("methodology", {
  ...base(),
  // D-93: latched by database triggers; demo origins cannot be promoted.
  production_blocked: boolean("production_blocked").notNull().default(false),
  created_by: mutableCreator(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  short_label: text("short_label"),
  type: methodologyType("type").notNull().default("equity_screening"),
  publisher: text("publisher"),
  source_title: text("source_title"),
  source_url: text("source_url"),
  official_or_inspired: officialOrInspired("official_or_inspired")
    .notNull()
    .default("internal_example"),
  licensing_status: licensingStatus("licensing_status")
    .notNull()
    .default("internal"),
  verified_by: text("verified_by"),
  verification_date: date("verification_date"),
  production_enabled: boolean("production_enabled").notNull().default(false),
  scope: text("scope"),
  current_version_label: text("current_version_label"),
  notes: text("notes"),
});
export const methodologyVersion = appSchema.table(
  "methodology_version",
  {
    ...base(),
    production_blocked: boolean("production_blocked").notNull().default(false),
    created_by: historicalCreator(),
    methodology_id: uuid("methodology_id")
      .notNull()
      .references(() => methodology.id),
    methodology_name: text("methodology_name"),
    version: text("version").notNull(),
    version_label: text("version_label"),
    effective_date: date("effective_date"),
    changelog: text("changelog"),
    supersedes_version_id: uuid("supersedes_version_id").references(
      (): AnyPgColumn => methodologyVersion.id,
    ),
    created_by_name: text("created_by_name"),
    production_enabled: boolean("production_enabled").notNull().default(false),
    workflow_status: workflowStatus("workflow_status")
      .notNull()
      .default("draft"),
    workflow_history: jsonb("workflow_history")
      .$type<WorkflowEntry[]>()
      .notNull()
      .default([]),
    purification_treatment: jsonb(
      "purification_treatment",
    ).$type<PurificationTreatment>(),
    // D-100: private candidate cases; D-11 freezes this content on finalization.
    analyst_test_cases: jsonb("analyst_test_cases")
      .$type<JsonObject[]>().notNull().default([]),
    impact_report_id: uuid("impact_report_id").references(
      (): AnyPgColumn => methodologyVersionReport.id,
    ),
    test_report_id: uuid("test_report_id").references(
      (): AnyPgColumn => methodologyVersionReport.id,
    ),
    approval_id: uuid("approval_id").references(() => auditEvent.id),
    approved_by: uuid("approved_by"),
    approved_at: time("approved_at"),
    is_public: boolean("is_public").notNull().default(false),
    // D-74: provenance, not source ownership. Supports shared documents.
    source_ids: ids("source_ids"),
    notes: text("notes"),
  },
  (t) => [
    unique("methodology_version_identity_unique").on(
      t.methodology_id,
      t.version,
    ),
    index("methodology_version_sources_gin").using("gin", t.source_ids),
  ],
);
export const methodologyCriterion = appSchema.table("methodology_criterion", {
  ...base(),
  created_by: historicalCreator(),
  methodology_id: uuid("methodology_id").references(() => methodology.id),
  methodology_version_id: uuid("methodology_version_id")
    .notNull()
    .references(() => methodologyVersion.id),
  criterion_type: criterionType("criterion_type").notNull(),
  label: text("label").notNull(),
  definition: text("definition"),
  formula_text: text("formula_text"),
  numerator_definition: text("numerator_definition"),
  denominator_definition: text("denominator_definition"),
  numerator_line_items: keys("numerator_line_items"),
  denominator_line_items: keys("denominator_line_items"),
  threshold: ratio("threshold"),
  threshold_unit: thresholdUnit("threshold_unit")
    .notNull()
    .default("percent_of_total_assets"),
  threshold_direction: thresholdDirection("threshold_direction")
    .notNull()
    .default("max"),
  borderline_margin: ratio("borderline_margin"),
  treatment_rules: text("treatment_rules"),
  treatment_rule_data: jsonb("treatment_rule_data").$type<TreatmentRuleData>(),
  edge_cases: text("edge_cases"),
  required_inputs: keys("required_inputs"),
  source_reference: text("source_reference"),
  effective_date: date("effective_date"),
  sort_order: integer("sort_order").notNull().default(0),
  notes: text("notes"),
});
export const reportKind = appSchema.enum("report_kind", ["impact", "test"]);
export const methodologyVersionReport = appSchema.table(
  "methodology_version_report",
  {
    ...base(),
    created_by: historicalCreator(),
    methodology_version_id: uuid("methodology_version_id")
      .notNull()
      .references((): AnyPgColumn => methodologyVersion.id),
    kind: reportKind("kind").notNull(),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    author_id: uuid("author_id"),
  },
);
