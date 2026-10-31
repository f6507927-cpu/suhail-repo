CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."audit_event_type" AS ENUM('methodology_create', 'methodology_update', 'methodology_version_create', 'methodology_version_production_enable', 'criterion_create', 'criterion_update', 'screening_run', 'explanation_generated', 'data_ingest', 'alert_created', 'edition_draft_created', 'edition_published', 'edition_revision', 'edition_status_change', 'score_model_version_create', 'score_model_status_change', 'score_model_backtest', 'editor_pick_saved', 'approval_recorded', 'performance_recorded', 'price_advance', 'editorial_setting_change', 'user_registered', 'user_role_change', 'user_mfa_reset', 'user_account_deleted', 'consent_recorded');--> statement-breakpoint
CREATE TYPE "app"."activity_category" AS ENUM('conventional_finance', 'interest_based_lending', 'insurance_conventional', 'alcohol', 'tobacco', 'gambling', 'adult_entertainment', 'pork_related', 'conventional_media', 'weapons_conventional', 'generic_permissible', 'real_estate_permissible', 'technology', 'healthcare', 'retail_permissible', 'industrials', 'energy', 'telecom', 'unclassified');--> statement-breakpoint
CREATE TYPE "app"."confidence_tier" AS ENUM('Verified', 'Calculated', 'Estimated', 'AI Interpretation');--> statement-breakpoint
CREATE TYPE "app"."criterion_type" AS ENUM('business_activity', 'non_permissible_revenue', 'interest_bearing_debt', 'cash_and_investments', 'receivables', 'custom_ratio');--> statement-breakpoint
CREATE TYPE "app"."edition_status" AS ENUM('draft', 'pending_approval', 'published_demo', 'published_live', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "app"."input_state" AS ENUM('reported', 'derived', 'estimated', 'unknown', 'missing');--> statement-breakpoint
CREATE TYPE "app"."locale" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "app"."screening_status" AS ENUM('passes_selected_methodology', 'requires_review', 'fails_selected_methodology', 'insufficient_data');--> statement-breakpoint
CREATE TYPE "app"."threshold_direction" AS ENUM('max', 'min', 'boolean');--> statement-breakpoint
CREATE TYPE "app"."threshold_unit" AS ENUM('percent_of_total_revenue', 'percent_of_total_assets', 'percent_of_market_cap', 'boolean', 'absolute');--> statement-breakpoint
CREATE TYPE "app"."user_role" AS ENUM('admin', 'editor', 'user');--> statement-breakpoint
CREATE TYPE "app"."validation_status" AS ENUM('passed', 'failed', 'not_run');--> statement-breakpoint
CREATE TYPE "app"."workflow_status" AS ENUM('draft', 'source_verified', 'rules_normalized', 'tests_passed', 'universe_tested', 'human_reviewed', 'approved', 'production');--> statement-breakpoint
CREATE TYPE "app"."approval_decision" AS ENUM('approved', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "app"."approval_stage" AS ENUM('qa', 'editorial', 'publish');--> statement-breakpoint
CREATE TYPE "app"."pick_type" AS ENUM('ai', 'editor');--> statement-breakpoint
CREATE TYPE "app"."revision_type" AS ENUM('correction', 'addition', 'retraction', 'administrative');--> statement-breakpoint
CREATE TYPE "app"."identifier_type" AS ENUM('isin', 'cusip', 'sedol', 'ticker', 'national_id');--> statement-breakpoint
CREATE TYPE "app"."instrument_type" AS ENUM('equity', 'reit', 'preferred', 'fund', 'sukuk', 'other');--> statement-breakpoint
CREATE TYPE "app"."listing_status" AS ENUM('listed', 'suspended', 'delisted', 'private');--> statement-breakpoint
CREATE TYPE "app"."period_type" AS ENUM('annual', 'semiannual', 'quarterly');--> statement-breakpoint
CREATE TYPE "app"."source_type" AS ENUM('annual_report', 'interim_report', 'regulatory_filing', 'investor_relations', 'market_data', 'data_provider', 'methodology_document', 'company_website', 'news', 'internal');--> statement-breakpoint
CREATE TYPE "app"."licensing_status" AS ENUM('licensed', 'public_document', 'unlicensed_adapted', 'internal', 'unknown');--> statement-breakpoint
CREATE TYPE "app"."methodology_type" AS ENUM('equity_screening', 'fund_screening', 'portfolio_screening');--> statement-breakpoint
CREATE TYPE "app"."official_or_inspired" AS ENUM('official', 'adapted', 'internal_example');--> statement-breakpoint
CREATE TYPE "app"."report_kind" AS ENUM('impact', 'test');--> statement-breakpoint
CREATE TYPE "app"."confidence" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "app"."criterion_result" AS ENUM('pass', 'borderline', 'fail', 'unknown');--> statement-breakpoint
CREATE TYPE "app"."data_adequacy" AS ENUM('adequate', 'adequate_with_estimates', 'inadequate');--> statement-breakpoint
CREATE TYPE "app"."unknown_severity" AS ENUM('blocking', 'review', 'informational');--> statement-breakpoint
CREATE TABLE "app"."analyst_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"user_id" uuid,
	"name_ar" text NOT NULL,
	"name_en" text,
	"title_ar" text,
	"title_en" text,
	"credentials" text,
	"headshot_object_key" text,
	"bio_ar" text,
	"bio_en" text,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "analyst_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"event_type" "app"."audit_event_type" NOT NULL,
	"entity_name" text,
	"entity_id" text,
	"summary" text NOT NULL,
	"details" jsonb,
	"actor_id" uuid,
	"actor_email" text,
	"actor_role" "app"."user_role",
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."job_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"cursor" jsonb,
	"counts" jsonb,
	"errors" jsonb,
	"timings" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"email" text,
	"phone" text,
	"full_name" text NOT NULL,
	"role" "app"."user_role" DEFAULT 'user' NOT NULL,
	"locale_pref" "app"."locale" DEFAULT 'ar' NOT NULL,
	"terms_version" text,
	"privacy_version" text,
	"accepted_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."edition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"edition_id" text NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"status" "app"."edition_status" DEFAULT 'draft' NOT NULL,
	"demo_mode" boolean DEFAULT true NOT NULL,
	"demo_mode_reason" text,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"market_timezone" text,
	"market_cutoff_note" text,
	"shariah_methodology_id" uuid,
	"shariah_methodology_name" text,
	"shariah_methodology_version_id" uuid,
	"shariah_methodology_version_label" text,
	"shariah_methodology_production_enabled" boolean DEFAULT false NOT NULL,
	"shariah_eligibility_rule" text,
	"data_snapshot_date" date,
	"calculation_version" text,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"content_hash" text,
	"generated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"published_by_email" text,
	"published_by" uuid,
	"superseded_by_edition_id" uuid,
	"disclaimer" text,
	"notes" text,
	CONSTRAINT "edition_revision_identity_unique" UNIQUE("edition_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "app"."edition_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"edition_id" uuid NOT NULL,
	"edition_label" text,
	"revision_number" integer DEFAULT 2 NOT NULL,
	"supersedes_revision_number" integer DEFAULT 1 NOT NULL,
	"revision_type" "app"."revision_type" DEFAULT 'correction' NOT NULL,
	"reason" text NOT NULL,
	"changes_summary" text,
	"picks_added" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"picks_changed" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"picks_retained" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"content_hash" text,
	"created_by_email" text
);
--> statement-breakpoint
CREATE TABLE "app"."editorial_approval" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"edition_id" uuid NOT NULL,
	"edition_label" text,
	"stage" "app"."approval_stage" DEFAULT 'qa' NOT NULL,
	"decision" "app"."approval_decision" DEFAULT 'approved' NOT NULL,
	"approver_id" uuid,
	"approver_email" text,
	"approver_name" text,
	"approver_role" "app"."user_role",
	"notes" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."editorial_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"setting_key" text DEFAULT 'editorial' NOT NULL,
	"allow_ineligible_editor_pick" boolean DEFAULT false NOT NULL,
	"default_shariah_methodology_version_id" uuid,
	"weekly_universe_note" text,
	"updated_by_email" text,
	"notes" text,
	CONSTRAINT "editorial_setting_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "app"."pick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"edition_id" uuid NOT NULL,
	"edition_label" text,
	"slot_key" text NOT NULL,
	"slot_index" integer DEFAULT 1 NOT NULL,
	"slot_label" text,
	"pick_type" "app"."pick_type" DEFAULT 'ai' NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"security_id" uuid NOT NULL,
	"ticker" text,
	"display_symbol" text,
	"company_name" text,
	"sector_label" text,
	"country" text,
	"currency" text,
	"market_cap_bucket" text,
	"shariah_run_id" uuid,
	"shariah_status" "app"."screening_status",
	"shariah_label" text,
	"shariah_methodology_version_label" text,
	"shariah_data_date" date,
	"shariah_eligibility_note" text,
	"unknowns" jsonb,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"data_as_of" date,
	"editor_author" text,
	"editor_author_email" text,
	"editor_thesis_ar" text,
	"editor_thesis_en" text,
	"editor_why_now_ar" text,
	"editor_why_now_en" text,
	"editor_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks_ar" text[],
	"risks_en" text[],
	"editor_valuation_context_ar" text,
	"editor_valuation_context_en" text,
	"editor_conflict_disclosure_ar" text,
	"editor_conflict_disclosure_en" text,
	"editor_published_at" timestamp with time zone,
	"ineligible_override" boolean DEFAULT false NOT NULL,
	"override_label" text,
	"starting_price" numeric(30, 6),
	"starting_price_date" date,
	"start_price_source" text,
	"disclaimer" text,
	CONSTRAINT "pick_editor_ar_required" CHECK ("app"."pick"."pick_type" <> 'editor' OR ("app"."pick"."editor_thesis_ar" IS NOT NULL AND "app"."pick"."editor_why_now_ar" IS NOT NULL AND "app"."pick"."editor_valuation_context_ar" IS NOT NULL AND "app"."pick"."editor_conflict_disclosure_ar" IS NOT NULL AND "app"."pick"."risks_ar" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "app"."business_segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"period_id" uuid,
	"segment_name" text NOT NULL,
	"description" text,
	"activity_category" "app"."activity_category" DEFAULT 'unclassified' NOT NULL,
	"category_basis" text,
	"revenue_amount" numeric(30, 6),
	"revenue_share" numeric(12, 6),
	"input_state" "app"."input_state" DEFAULT 'reported' NOT NULL,
	"confidence_tier" "app"."confidence_tier" DEFAULT 'Verified' NOT NULL,
	"source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"name_ar" text,
	"legal_name" text,
	"country" text,
	"domicile" text,
	"description" text,
	"description_ar" text,
	"description_en" text,
	"sector_label" text,
	"industry_label" text,
	"website" text,
	"founded_year" integer,
	"fiscal_year_end" text,
	"reporting_currency" text,
	"sector_label_note" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "app"."exchange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"mic" text,
	"country" text,
	"region" text,
	"timezone" text,
	"default_currency" text,
	"regulator" text,
	"settlement_convention" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	CONSTRAINT "exchange_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app"."financial_fact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"line_item" text NOT NULL,
	"label" text,
	"value" numeric(30, 6),
	"value_text" text,
	"currency" text,
	"unit_scale" text DEFAULT 'absolute' NOT NULL,
	"input_state" "app"."input_state" DEFAULT 'reported' NOT NULL,
	"confidence_tier" "app"."confidence_tier" DEFAULT 'Verified' NOT NULL,
	"source_id" uuid,
	"as_of_date" date,
	"mapping_note" text,
	"unknown_note" text,
	"is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."financial_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"period_type" "app"."period_type" DEFAULT 'annual' NOT NULL,
	"fiscal_year" integer,
	"fiscal_period_label" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"reported_date" date,
	"currency" text,
	"is_latest" boolean DEFAULT false NOT NULL,
	"filing_reference" text,
	"source_id" uuid,
	"notes" text,
	CONSTRAINT "financial_period_identity_unique" UNIQUE("company_id","period_type","fiscal_year","fiscal_period_label")
);
--> statement-breakpoint
CREATE TABLE "app"."price_bar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"security_id" uuid NOT NULL,
	"ticker" text,
	"date" date NOT NULL,
	"close" numeric(30, 6),
	"currency" text,
	"week_index" integer DEFAULT 0 NOT NULL,
	"advance_batch" text,
	"is_synthetic" boolean DEFAULT true NOT NULL,
	"source_label" text
);
--> statement-breakpoint
CREATE TABLE "app"."security" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"company_id" uuid,
	"exchange_id" uuid,
	"exchange_code" text,
	"ticker" text NOT NULL,
	"display_symbol" text,
	"identifier_type" "app"."identifier_type" DEFAULT 'ticker' NOT NULL,
	"identifier_value" text,
	"currency" text,
	"instrument_type" "app"."instrument_type" DEFAULT 'equity' NOT NULL,
	"listing_status" "app"."listing_status" DEFAULT 'listed' NOT NULL,
	"slug" text NOT NULL,
	"in_universe" boolean DEFAULT false NOT NULL,
	"coverage_analyst_id" uuid,
	"coverage_started_at" timestamp with time zone,
	"demo_label" text,
	"notes" text,
	CONSTRAINT "security_slug_unique" UNIQUE("slug"),
	CONSTRAINT "security_exchange_ticker_unique" UNIQUE("exchange_id","ticker")
);
--> statement-breakpoint
CREATE TABLE "app"."source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"label" text NOT NULL,
	"source_type" "app"."source_type" NOT NULL,
	"provider" text,
	"document_title" text,
	"document_reference" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone,
	"reporting_period" text,
	"confidence_tier" "app"."confidence_tier" DEFAULT 'Verified' NOT NULL,
	"is_synthetic" boolean DEFAULT true NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "app"."methodology" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_label" text,
	"type" "app"."methodology_type" DEFAULT 'equity_screening' NOT NULL,
	"publisher" text,
	"source_title" text,
	"source_url" text,
	"official_or_inspired" "app"."official_or_inspired" DEFAULT 'internal_example' NOT NULL,
	"licensing_status" "app"."licensing_status" DEFAULT 'internal' NOT NULL,
	"verified_by" text,
	"verification_date" date,
	"production_enabled" boolean DEFAULT false NOT NULL,
	"scope" text,
	"current_version_label" text,
	"notes" text,
	CONSTRAINT "methodology_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "app"."methodology_criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"methodology_id" uuid,
	"methodology_version_id" uuid NOT NULL,
	"criterion_type" "app"."criterion_type" NOT NULL,
	"label" text NOT NULL,
	"definition" text,
	"formula_text" text,
	"numerator_definition" text,
	"denominator_definition" text,
	"numerator_line_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"denominator_line_items" text[] DEFAULT '{}'::text[] NOT NULL,
	"threshold" numeric(12, 6),
	"threshold_unit" "app"."threshold_unit" DEFAULT 'percent_of_total_assets' NOT NULL,
	"threshold_direction" "app"."threshold_direction" DEFAULT 'max' NOT NULL,
	"borderline_margin" numeric(12, 6),
	"treatment_rules" text,
	"treatment_rule_data" jsonb,
	"edge_cases" text,
	"required_inputs" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_reference" text,
	"effective_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "app"."methodology_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"methodology_id" uuid NOT NULL,
	"methodology_name" text,
	"version" text NOT NULL,
	"version_label" text,
	"effective_date" date,
	"changelog" text,
	"supersedes_version_id" uuid,
	"created_by_name" text,
	"production_enabled" boolean DEFAULT false NOT NULL,
	"workflow_status" "app"."workflow_status" DEFAULT 'draft' NOT NULL,
	"workflow_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"purification_treatment" jsonb,
	"impact_report_id" uuid,
	"test_report_id" uuid,
	"approval_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"is_public" boolean DEFAULT false NOT NULL,
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"notes" text,
	CONSTRAINT "methodology_version_identity_unique" UNIQUE("methodology_id","version")
);
--> statement-breakpoint
CREATE TABLE "app"."methodology_version_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"methodology_version_id" uuid NOT NULL,
	"kind" "app"."report_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"author_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."explanation_object" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"screening_run_id" uuid NOT NULL,
	"security_id" uuid,
	"methodology_version_label" text,
	"claim" text,
	"evidence" jsonb,
	"unknowns" jsonb,
	"sources" jsonb,
	"methodology" jsonb,
	"allowed_numbers" text[] DEFAULT '{}'::text[] NOT NULL,
	"allowed_tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_text" text,
	"ai_model" text,
	"prompt_version" text,
	"validation_status" "app"."validation_status" DEFAULT 'not_run' NOT NULL,
	"validation_details" text[] DEFAULT '{}'::text[] NOT NULL,
	"generated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."screening_criterion_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"screening_run_id" uuid NOT NULL,
	"criterion_id" uuid,
	"criterion_type" "app"."criterion_type" NOT NULL,
	"criterion_label" text,
	"result" "app"."criterion_result" NOT NULL,
	"numerator_value" numeric(30, 6),
	"numerator_definition" text,
	"denominator_value" numeric(30, 6),
	"denominator_definition" text,
	"ratio" numeric(12, 6),
	"threshold" numeric(12, 6),
	"threshold_unit" "app"."threshold_unit",
	"threshold_direction" "app"."threshold_direction",
	"borderline_margin" numeric(12, 6),
	"input_states" "app"."input_state"[] DEFAULT '{}' NOT NULL,
	"confidence_tier" "app"."confidence_tier",
	"source_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"calculation_trace" text,
	"result_reason" text,
	"source_reference" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."screening_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"security_id" uuid NOT NULL,
	"company_id" uuid,
	"exchange_code" text,
	"ticker" text,
	"company_name" text,
	"methodology_id" uuid,
	"methodology_name" text,
	"methodology_version_id" uuid NOT NULL,
	"methodology_version_label" text,
	"financial_period_id" uuid,
	"financial_period_label" text,
	"financial_snapshot_id" text,
	"calculation_version" text,
	"data_adequacy" "app"."data_adequacy" DEFAULT 'adequate' NOT NULL,
	"confidence" "app"."confidence",
	"status" "app"."screening_status" NOT NULL,
	"status_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hash_payload" jsonb NOT NULL,
	"data_as_of" date,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"immutable_hash" text NOT NULL,
	"engine_version" text
);
--> statement-breakpoint
CREATE TABLE "app"."screening_unknown" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"screening_run_id" uuid NOT NULL,
	"criterion_id" uuid,
	"criterion_type" "app"."criterion_type",
	"criterion_label" text,
	"field_or_input" text NOT NULL,
	"why_missing" text,
	"effect" text,
	"source_reference" text,
	"severity" "app"."unknown_severity" DEFAULT 'review' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."analyst_profile" ADD CONSTRAINT "analyst_profile_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."analyst_profile" ADD CONSTRAINT "analyst_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."job_run" ADD CONSTRAINT "job_run_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition" ADD CONSTRAINT "edition_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition" ADD CONSTRAINT "edition_shariah_methodology_id_methodology_id_fk" FOREIGN KEY ("shariah_methodology_id") REFERENCES "app"."methodology"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition" ADD CONSTRAINT "edition_shariah_methodology_version_id_methodology_version_id_fk" FOREIGN KEY ("shariah_methodology_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition" ADD CONSTRAINT "edition_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition" ADD CONSTRAINT "edition_superseded_by_edition_id_edition_id_fk" FOREIGN KEY ("superseded_by_edition_id") REFERENCES "app"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."edition_revision" ADD CONSTRAINT "edition_revision_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "app"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."editorial_approval" ADD CONSTRAINT "editorial_approval_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "app"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."editorial_setting" ADD CONSTRAINT "editorial_setting_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."editorial_setting" ADD CONSTRAINT "editorial_setting_default_shariah_methodology_version_id_methodology_version_id_fk" FOREIGN KEY ("default_shariah_methodology_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pick" ADD CONSTRAINT "pick_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pick" ADD CONSTRAINT "pick_edition_id_edition_id_fk" FOREIGN KEY ("edition_id") REFERENCES "app"."edition"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pick" ADD CONSTRAINT "pick_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."pick" ADD CONSTRAINT "pick_shariah_run_id_screening_run_id_fk" FOREIGN KEY ("shariah_run_id") REFERENCES "app"."screening_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."business_segment" ADD CONSTRAINT "business_segment_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."business_segment" ADD CONSTRAINT "business_segment_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."business_segment" ADD CONSTRAINT "business_segment_period_id_financial_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "app"."financial_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."business_segment" ADD CONSTRAINT "business_segment_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."company" ADD CONSTRAINT "company_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."exchange" ADD CONSTRAINT "exchange_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_period_id_financial_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "app"."financial_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_period" ADD CONSTRAINT "financial_period_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_period" ADD CONSTRAINT "financial_period_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."financial_period" ADD CONSTRAINT "financial_period_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD CONSTRAINT "price_bar_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD CONSTRAINT "price_bar_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security" ADD CONSTRAINT "security_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security" ADD CONSTRAINT "security_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security" ADD CONSTRAINT "security_exchange_id_exchange_id_fk" FOREIGN KEY ("exchange_id") REFERENCES "app"."exchange"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security" ADD CONSTRAINT "security_coverage_analyst_id_analyst_profile_id_fk" FOREIGN KEY ("coverage_analyst_id") REFERENCES "app"."analyst_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."source" ADD CONSTRAINT "source_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology" ADD CONSTRAINT "methodology_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_criterion" ADD CONSTRAINT "methodology_criterion_methodology_id_methodology_id_fk" FOREIGN KEY ("methodology_id") REFERENCES "app"."methodology"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_criterion" ADD CONSTRAINT "methodology_criterion_methodology_version_id_methodology_version_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD CONSTRAINT "methodology_version_methodology_id_methodology_id_fk" FOREIGN KEY ("methodology_id") REFERENCES "app"."methodology"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD CONSTRAINT "methodology_version_supersedes_version_id_methodology_version_id_fk" FOREIGN KEY ("supersedes_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD CONSTRAINT "methodology_version_impact_report_id_methodology_version_report_id_fk" FOREIGN KEY ("impact_report_id") REFERENCES "app"."methodology_version_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD CONSTRAINT "methodology_version_test_report_id_methodology_version_report_id_fk" FOREIGN KEY ("test_report_id") REFERENCES "app"."methodology_version_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD CONSTRAINT "methodology_version_approval_id_audit_event_id_fk" FOREIGN KEY ("approval_id") REFERENCES "app"."audit_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."methodology_version_report" ADD CONSTRAINT "methodology_version_report_methodology_version_id_methodology_version_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."explanation_object" ADD CONSTRAINT "explanation_object_screening_run_id_screening_run_id_fk" FOREIGN KEY ("screening_run_id") REFERENCES "app"."screening_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."explanation_object" ADD CONSTRAINT "explanation_object_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_criterion_result" ADD CONSTRAINT "screening_criterion_result_screening_run_id_screening_run_id_fk" FOREIGN KEY ("screening_run_id") REFERENCES "app"."screening_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_criterion_result" ADD CONSTRAINT "screening_criterion_result_criterion_id_methodology_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "app"."methodology_criterion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_run" ADD CONSTRAINT "screening_run_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_run" ADD CONSTRAINT "screening_run_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "app"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_run" ADD CONSTRAINT "screening_run_methodology_id_methodology_id_fk" FOREIGN KEY ("methodology_id") REFERENCES "app"."methodology"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_run" ADD CONSTRAINT "screening_run_methodology_version_id_methodology_version_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "app"."methodology_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_run" ADD CONSTRAINT "screening_run_financial_period_id_financial_period_id_fk" FOREIGN KEY ("financial_period_id") REFERENCES "app"."financial_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_unknown" ADD CONSTRAINT "screening_unknown_screening_run_id_screening_run_id_fk" FOREIGN KEY ("screening_run_id") REFERENCES "app"."screening_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."screening_unknown" ADD CONSTRAINT "screening_unknown_criterion_id_methodology_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "app"."methodology_criterion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pick_sources_gin" ON "app"."pick" USING gin ("source_ids");--> statement-breakpoint
CREATE INDEX "business_segment_source_idx" ON "app"."business_segment" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_fact_current_unique" ON "app"."financial_fact" USING btree ("company_id","period_id","line_item") WHERE "app"."financial_fact"."is_current";--> statement-breakpoint
CREATE INDEX "financial_fact_source_idx" ON "app"."financial_fact" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_period_latest_unique" ON "app"."financial_period" USING btree ("company_id","period_type") WHERE "app"."financial_period"."is_latest";--> statement-breakpoint
CREATE INDEX "financial_period_source_idx" ON "app"."financial_period" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "security_public_company_idx" ON "app"."security" USING btree ("company_id") WHERE "app"."security"."in_universe" AND "app"."security"."listing_status" = 'listed';--> statement-breakpoint
CREATE INDEX "methodology_version_sources_gin" ON "app"."methodology_version" USING gin ("source_ids");--> statement-breakpoint
CREATE INDEX "screening_criterion_result_sources_gin" ON "app"."screening_criterion_result" USING gin ("source_ids");