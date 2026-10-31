import { sql } from "drizzle-orm";
import {
  boolean,
  text,
  uuid,
  jsonb,
  date,
  integer,
  unique,
  check,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  appSchema,
  base,
  money,
  ids,
  time,
  editionStatus,
  screeningStatus,
  userRole,
} from "./core";
import { mutableCreator, historicalCreator, users } from "./accounts";
import { security } from "./market";
import { methodology, methodologyVersion } from "./methodology";
import { screeningRun } from "./screening";
import type { JsonObject, EditorEvidence } from "./types";

export const edition = appSchema.table(
  "edition",
  {
    ...base(),
    created_by: mutableCreator(),
    // Human-facing edition label vs UUID references in children.
    edition_id: text("edition_id").notNull(),
    week_start: date("week_start").notNull(),
    week_end: date("week_end").notNull(),
    status: editionStatus("status").notNull().default("draft"),
    demo_mode: boolean("demo_mode").notNull().default(true),
    demo_mode_reason: text("demo_mode_reason"),
    revision_number: integer("revision_number").notNull().default(1),
    market_timezone: text("market_timezone"),
    market_cutoff_note: text("market_cutoff_note"),
    shariah_methodology_id: uuid("shariah_methodology_id").references(
      () => methodology.id,
    ),
    shariah_methodology_name: text("shariah_methodology_name"),
    shariah_methodology_version_id: uuid(
      "shariah_methodology_version_id",
    ).references(() => methodologyVersion.id),
    shariah_methodology_version_label: text(
      "shariah_methodology_version_label",
    ),
    shariah_methodology_production_enabled: boolean(
      "shariah_methodology_production_enabled",
    )
      .notNull()
      .default(false),
    shariah_eligibility_rule: text("shariah_eligibility_rule"),
    data_snapshot_date: date("data_snapshot_date"),
    calculation_version: text("calculation_version"),
    source_ids: ids("source_ids"),
    content_hash: text("content_hash"),
    generated_at: time("generated_at"),
    published_at: time("published_at"),
    published_by_email: text("published_by_email"),
    published_by: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    superseded_by_edition_id: uuid("superseded_by_edition_id").references(
      (): AnyPgColumn => edition.id,
    ),
    disclaimer: text("disclaimer"),
    notes: text("notes"),
  },
  (t) => [
    unique("edition_revision_identity_unique").on(
      t.edition_id,
      t.revision_number,
    ),
  ],
);
export const pickType = appSchema.enum("pick_type", ["ai", "editor"]);
export const pick = appSchema.table(
  "pick",
  {
    ...base(),
    created_by: mutableCreator(),
    edition_id: uuid("edition_id")
      .notNull()
      .references(() => edition.id),
    edition_label: text("edition_label"),
    slot_key: text("slot_key").notNull(),
    slot_index: integer("slot_index").notNull().default(1),
    slot_label: text("slot_label"),
    pick_type: pickType("pick_type").notNull().default("ai"),
    rank: integer("rank").notNull().default(1),
    security_id: uuid("security_id")
      .notNull()
      .references(() => security.id),
    ticker: text("ticker"),
    display_symbol: text("display_symbol"),
    company_name: text("company_name"),
    sector_label: text("sector_label"),
    country: text("country"),
    currency: text("currency"),
    market_cap_bucket: text("market_cap_bucket"),
    shariah_run_id: uuid("shariah_run_id").references(() => screeningRun.id),
    shariah_status: screeningStatus("shariah_status"),
    shariah_label: text("shariah_label"),
    shariah_methodology_version_label: text(
      "shariah_methodology_version_label",
    ),
    shariah_data_date: date("shariah_data_date"),
    shariah_eligibility_note: text("shariah_eligibility_note"),
    unknowns: jsonb("unknowns").$type<JsonObject[]>(),
    source_ids: ids("source_ids"),
    data_as_of: date("data_as_of"),
    editor_author: text("editor_author"),
    editor_author_email: text("editor_author_email"),
    editor_thesis_ar: text("editor_thesis_ar"),
    editor_thesis_en: text("editor_thesis_en"),
    editor_why_now_ar: text("editor_why_now_ar"),
    editor_why_now_en: text("editor_why_now_en"),
    editor_evidence: jsonb("editor_evidence")
      .$type<EditorEvidence[]>()
      .notNull()
      .default([]),
    risks_ar: text("risks_ar").array(),
    risks_en: text("risks_en").array(),
    editor_valuation_context_ar: text("editor_valuation_context_ar"),
    editor_valuation_context_en: text("editor_valuation_context_en"),
    editor_conflict_disclosure_ar: text("editor_conflict_disclosure_ar"),
    editor_conflict_disclosure_en: text("editor_conflict_disclosure_en"),
    editor_published_at: time("editor_published_at"),
    ineligible_override: boolean("ineligible_override")
      .notNull()
      .default(false),
    override_label: text("override_label"),
    starting_price: money("starting_price"),
    starting_price_date: date("starting_price_date"),
    start_price_source: text("start_price_source"),
    disclaimer: text("disclaimer"),
  },
  (t) => [
    check(
      "pick_editor_ar_required",
      sql`${t.pick_type} <> 'editor' OR (${t.editor_thesis_ar} IS NOT NULL AND ${t.editor_why_now_ar} IS NOT NULL AND ${t.editor_valuation_context_ar} IS NOT NULL AND ${t.editor_conflict_disclosure_ar} IS NOT NULL AND ${t.risks_ar} IS NOT NULL)`,
    ),
    index("pick_sources_gin").using("gin", t.source_ids),
  ],
);
export const approvalStage = appSchema.enum("approval_stage", [
  "qa",
  "editorial",
  "publish",
]);
export const approvalDecision = appSchema.enum("approval_decision", [
  "approved",
  "rejected",
  "changes_requested",
]);
export const editorialApproval = appSchema.table("editorial_approval", {
  ...base(),
  created_by: historicalCreator(),
  edition_id: uuid("edition_id")
    .notNull()
    .references(() => edition.id),
  edition_label: text("edition_label"),
  stage: approvalStage("stage").notNull().default("qa"),
  decision: approvalDecision("decision").notNull().default("approved"),
  approver_id: uuid("approver_id"),
  approver_email: text("approver_email"),
  approver_name: text("approver_name"),
  approver_role: userRole("approver_role"),
  notes: text("notes"),
  decided_at: time("decided_at").notNull().defaultNow(),
});
export const revisionType = appSchema.enum("revision_type", [
  "correction",
  "addition",
  "retraction",
  "administrative",
]);
export const editionRevision = appSchema.table("edition_revision", {
  ...base(),
  created_by: historicalCreator(),
  edition_id: uuid("edition_id")
    .notNull()
    .references(() => edition.id),
  edition_label: text("edition_label"),
  revision_number: integer("revision_number").notNull().default(2),
  supersedes_revision_number: integer("supersedes_revision_number")
    .notNull()
    .default(1),
  revision_type: revisionType("revision_type").notNull().default("correction"),
  reason: text("reason").notNull(),
  changes_summary: text("changes_summary"),
  picks_added: ids("picks_added"),
  picks_changed: ids("picks_changed"),
  picks_retained: ids("picks_retained"),
  content_hash: text("content_hash"),
  created_by_email: text("created_by_email"),
});
export const editorialSetting = appSchema.table("editorial_setting", {
  ...base(),
  created_by: mutableCreator(),
  setting_key: text("setting_key").notNull().default("editorial").unique(),
  allow_ineligible_editor_pick: boolean("allow_ineligible_editor_pick")
    .notNull()
    .default(false),
  default_shariah_methodology_version_id: uuid(
    "default_shariah_methodology_version_id",
  ).references(() => methodologyVersion.id),
  weekly_universe_note: text("weekly_universe_note"),
  updated_by_email: text("updated_by_email"),
  notes: text("notes"),
});
