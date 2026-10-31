import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  timestamp,
  boolean,
  numeric,
  text,
} from "drizzle-orm/pg-core";

export const appSchema = pgSchema("app");
export const userRole = appSchema.enum("user_role", [
  "admin",
  "editor",
  "user",
]);
export const locale = appSchema.enum("locale", ["ar", "en"]);
export const inputState = appSchema.enum("input_state", [
  "reported",
  "derived",
  "estimated",
  "unknown",
  "missing",
]);
export const confidenceTier = appSchema.enum("confidence_tier", [
  "Verified",
  "Calculated",
  "Estimated",
  "AI Interpretation",
]);
export const activityCategory = appSchema.enum("activity_category", [
  "conventional_finance",
  "interest_based_lending",
  "insurance_conventional",
  "alcohol",
  "tobacco",
  "gambling",
  "adult_entertainment",
  "pork_related",
  "conventional_media",
  "weapons_conventional",
  "generic_permissible",
  "real_estate_permissible",
  "technology",
  "healthcare",
  "retail_permissible",
  "industrials",
  "energy",
  "telecom",
  "unclassified",
]);
export const criterionType = appSchema.enum("criterion_type", [
  "business_activity",
  "non_permissible_revenue",
  "interest_bearing_debt",
  "cash_and_investments",
  "receivables",
  "custom_ratio",
]);
export const thresholdUnit = appSchema.enum("threshold_unit", [
  "percent_of_total_revenue",
  "percent_of_total_assets",
  "percent_of_market_cap",
  "boolean",
  "absolute",
]);
export const thresholdDirection = appSchema.enum("threshold_direction", [
  "max",
  "min",
  "boolean",
]);
export const workflowStatus = appSchema.enum("workflow_status", [
  "draft",
  "source_verified",
  "rules_normalized",
  "tests_passed",
  "universe_tested",
  "human_reviewed",
  "approved",
  "production",
]);
export const screeningStatus = appSchema.enum("screening_status", [
  "passes_selected_methodology",
  "requires_review",
  "fails_selected_methodology",
  "insufficient_data",
]);
export const validationStatus = appSchema.enum("validation_status", [
  "passed",
  "failed",
  "not_run",
]);
export const editionStatus = appSchema.enum("edition_status", [
  "draft",
  "pending_approval",
  "published_demo",
  "published_live",
  "rejected",
  "superseded",
]);
export const time = (name: string) => timestamp(name, { withTimezone: true });
export const money = (name: string) =>
  numeric(name, { precision: 30, scale: 6, mode: "number" });
export const ratio = (name: string) =>
  numeric(name, { precision: 12, scale: 6, mode: "number" });
export const keys = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);
// D-73: historical ID arrays deliberately have no foreign keys.
export const ids = (name: string) =>
  uuid(name)
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`);
export const base = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  created_at: time("created_at").notNull().defaultNow(),
  updated_at: time("updated_at").notNull().defaultNow(),
  is_demo: boolean("is_demo").notNull().default(false),
});
