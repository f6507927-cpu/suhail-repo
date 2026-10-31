import {
  boolean,
  text,
  uuid,
  jsonb,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { appSchema, base, userRole, locale, time } from "./core";
import type { JsonObject } from "./types";

export const users = appSchema.table("users", {
  ...base(),
  // D-35: Supabase supplies this ID; no dependency on auth schema in migrations.
  id: uuid("id").primaryKey(),
  created_by: uuid("created_by").references((): AnyPgColumn => users.id, {
    onDelete: "set null",
  }),
  email: text("email"),
  phone: text("phone"),
  full_name: text("full_name").notNull(),
  role: userRole("role").notNull().default("user"),
  locale_pref: locale("locale_pref").notNull().default("ar"),
  terms_version: text("terms_version"),
  privacy_version: text("privacy_version"),
  accepted_at: time("accepted_at"),
  last_sign_in_at: time("last_sign_in_at"),
});
export const mutableCreator = () =>
  uuid("created_by").references(() => users.id, { onDelete: "set null" });
// D-76 / D-50: immutable historical identities survive account deletion unchanged.
export const historicalCreator = () => uuid("created_by");
export const analystProfile = appSchema.table("analyst_profile", {
  ...base(),
  created_by: mutableCreator(),
  user_id: uuid("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  name_ar: text("name_ar").notNull(),
  name_en: text("name_en"),
  title_ar: text("title_ar"),
  title_en: text("title_en"),
  credentials: text("credentials"),
  headshot_object_key: text("headshot_object_key"),
  bio_ar: text("bio_ar"),
  bio_en: text("bio_en"),
  active: boolean("active").notNull().default(false),
});
export const auditEventType = appSchema.enum("audit_event_type", [
  "methodology_create",
  "methodology_update",
  "methodology_version_create",
  "methodology_version_production_enable",
  "criterion_create",
  "criterion_update",
  "screening_run",
  "explanation_generated",
  "data_ingest",
  "alert_created",
  "edition_draft_created",
  "edition_published",
  "edition_revision",
  "edition_status_change",
  "score_model_version_create",
  "score_model_status_change",
  "score_model_backtest",
  "editor_pick_saved",
  "approval_recorded",
  "performance_recorded",
  "price_advance",
  "editorial_setting_change",
  "user_registered",
  "user_role_change",
  "user_mfa_reset",
  "user_account_deleted",
  "consent_recorded",
]);
export const auditEvent = appSchema.table("audit_event", {
  ...base(),
  created_by: historicalCreator(),
  event_type: auditEventType("event_type").notNull(),
  entity_name: text("entity_name"),
  entity_id: text("entity_id"),
  summary: text("summary").notNull(),
  details: jsonb("details").$type<JsonObject>(),
  actor_id: uuid("actor_id"),
  actor_email: text("actor_email"),
  actor_role: userRole("actor_role"),
  occurred_at: time("occurred_at").notNull().defaultNow(),
});
// D-28 does not define job status/cursor vocabulary: preserve opaque metadata,
// without inventing an execution state machine in this database-only step.
export const jobRun = appSchema.table("job_run", {
  ...base(),
  created_by: mutableCreator(),
  job_name: text("job_name").notNull(),
  status: text("status").notNull(),
  cursor: jsonb("cursor").$type<JsonObject>(),
  counts: jsonb("counts").$type<Record<string, number>>(),
  errors: jsonb("errors").$type<JsonObject[]>(),
  timings: jsonb("timings").$type<Record<string, number>>(),
  started_at: time("started_at"),
  finished_at: time("finished_at"),
});
