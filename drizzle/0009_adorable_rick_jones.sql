DROP INDEX "app"."financial_fact_current_unique";--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "security_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."price_bar" ADD COLUMN "month_end_for" date;--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD CONSTRAINT "financial_fact_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_fact_security_current_unique" ON "app"."financial_fact" USING btree ("company_id","period_id","line_item","security_id") WHERE "app"."financial_fact"."is_current" AND "app"."financial_fact"."security_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_fact_current_unique" ON "app"."financial_fact" USING btree ("company_id","period_id","line_item") WHERE "app"."financial_fact"."is_current" AND "app"."financial_fact"."security_id" IS NULL;
--> statement-breakpoint
-- D-122: the public projection must be able to restrict a share-class fact.
GRANT SELECT (security_id) ON app.financial_fact TO suhail_public;