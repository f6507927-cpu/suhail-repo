ALTER TABLE "app"."company" ADD COLUMN "cik" text;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "origin" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "protected_current" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "calculation_version" text;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "evidence_key" text;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "sec_baseline_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."security" ADD COLUMN "last_ingest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."security" ADD COLUMN "last_ingest_error" text;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_sec_baseline_id_financial_fact_id_fk" FOREIGN KEY ("sec_baseline_id") REFERENCES "app"."financial_fact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD CONSTRAINT "price_bar_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "app"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."company" ADD CONSTRAINT "company_cik_unique" UNIQUE("cik");--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_evidence_key_unique" UNIQUE("evidence_key");