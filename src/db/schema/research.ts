import { bigint, boolean, integer, jsonb, text, uuid, date, numeric } from "drizzle-orm/pg-core";
import { appSchema, time, userRole } from "./core";
import { security } from "./market";
import type { ResearchPacket, ValidationIssue } from "../../ai/research/contracts";
import type { ResearchDraft } from "../../ai/research/draft";
import type { Checklist, ResearchState } from "../../lib/research/contracts";
import type { ScopeSettings } from "../../lib/research/workflow";

// D-216: private tables only; public views/publication belong to P4.
export const researchPacket = appSchema.table("research_packet", {
  id: uuid("id").primaryKey().defaultRandom(),
  security_id: uuid("security_id").notNull().references(() => security.id),
  packet_schema_version: text("packet_schema_version").notNull(),
  packet_hash: text("packet_hash").notNull(),
  payload: jsonb("payload").$type<ResearchPacket>().notNull(),
  built_at: time("built_at").notNull(),
});
export const researchSetting = appSchema.table("research_setting", {
  id: integer("id").primaryKey().default(1),
  ai_research_publishing: boolean("ai_research_publishing").notNull().default(false),
  recommendation_wording: text("recommendation_wording").notNull().default("research_language"),
  price_targets_enabled: boolean("price_targets_enabled").notNull().default(false),
  monthly_token_budget: bigint("monthly_token_budget", { mode: "number" }).notNull().default(0),
  max_active_research_stocks: integer("max_active_research_stocks").notNull().default(0),
  allowed_sectors: jsonb("allowed_sectors").$type<ScopeSettings["allowed_sectors"]>().notNull().default([]),
  max_packet_age_days: integer("max_packet_age_days"),
  max_financial_age_days: integer("max_financial_age_days"),
  price_move_threshold_percent: numeric("price_move_threshold_percent"),
  publication_age_days: integer("publication_age_days"),
  gate_decision_id: text("gate_decision_id"),
  gate_lawyer_answer_ref: text("gate_lawyer_answer_ref"),
  gate_enabled_by: uuid("gate_enabled_by"),
  gate_enabled_at: time("gate_enabled_at"),
});
export const researchUsage = appSchema.table("research_usage", {
  month: date("month").primaryKey(),
  used: bigint("used", { mode: "number" }).notNull().default(0),
  reserved: bigint("reserved", { mode: "number" }).notNull().default(0),
});
export const researchDraft = appSchema.table("research_draft", {
  id: uuid("id").primaryKey().defaultRandom(),
  security_id: uuid("security_id").notNull().references(() => security.id),
  packet_id: uuid("packet_id").notNull().references(() => researchPacket.id),
  previous_draft_id: uuid("previous_draft_id"),
  state: text("state").$type<ResearchState>().notNull().default("requested"),
  ai_output: jsonb("ai_output").$type<ResearchDraft>(),
  analyst_text: jsonb("analyst_text").$type<ResearchDraft>(),
  text_hash: text("text_hash"),
  validation_text_hash: text("validation_text_hash"),
  validation_results: jsonb("validation_results").$type<ValidationIssue[]>().notNull(),
  analyst_instructions: text("analyst_instructions").notNull().default(""),
  input_tokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
  output_tokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  model: text("model"),
  model_version: text("model_version"),
  prompt_version: text("prompt_version").notNull(),
  validator_version: text("validator_version").notNull(),
  failure_reason: text("failure_reason"),
  created_at: time("created_at").notNull().defaultNow(),
  updated_at: time("updated_at").notNull().defaultNow(),
});
export const researchReviewEvent = appSchema.table("research_review_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  draft_id: uuid("draft_id").references(() => researchDraft.id),
  actor_id: uuid("actor_id").notNull(),
  actor_role: userRole("actor_role").notNull(),
  occurred_at: time("occurred_at").notNull().defaultNow(),
  from_state: text("from_state").$type<ResearchState>(),
  to_state: text("to_state").$type<ResearchState>(),
  packet_hash: text("packet_hash"),
  model: text("model"),
  model_version: text("model_version"),
  prompt_version: text("prompt_version").notNull(),
  validator_version: text("validator_version").notNull(),
  text_hash: text("text_hash"),
  checklist: jsonb("checklist").$type<Checklist>(),
  edit_reasons: text("edit_reasons").array().notNull().default([]),
  note: text("note").notNull().default(""),
});
