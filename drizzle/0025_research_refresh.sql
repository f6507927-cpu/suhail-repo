ALTER TYPE "app"."audit_event_type" ADD VALUE 'research_staleness';--> statement-breakpoint
ALTER TYPE "app"."audit_event_type" ADD VALUE 'research_refresh_requested';--> statement-breakpoint
CREATE TABLE "app"."research_refresh" (
	"draft_id" uuid PRIMARY KEY NOT NULL,
	"changes" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."research_staleness_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"draft_id" uuid NOT NULL,
	"outdated" boolean NOT NULL,
	"outdated_reasons" text[] NOT NULL,
	"analyst_view_review_required" boolean NOT NULL,
	"cleared_version_id" uuid,
	"cleared_stop_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."research_refresh" ADD CONSTRAINT "research_refresh_draft_id_research_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."research_draft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."research_staleness_event" ADD CONSTRAINT "research_staleness_event_draft_id_research_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."research_draft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_staleness_draft_event" ON "app"."research_staleness_event" USING btree ("draft_id","id" DESC NULLS LAST);
--> statement-breakpoint
ALTER TABLE app.research_refresh ADD CONSTRAINT research_refresh_changes_array CHECK (jsonb_typeof(changes)='array');
ALTER TABLE app.research_staleness_event ADD CONSTRAINT research_staleness_reasons CHECK (
  outdated=(cardinality(outdated_reasons)>0) AND array_position(outdated_reasons, NULL) IS NULL
  AND outdated_reasons <@ ARRAY['new_filing','status_changed','price_moved','aged']::text[]
  AND (cleared_stop_id IS NULL OR cleared_version_id IS NOT NULL)
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['research_refresh','research_staleness_event'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,suhail_public,suhail_app',t);
    EXECUTE format('GRANT SELECT,INSERT ON app.%I TO suhail_app',t);
    EXECUTE format('CREATE POLICY research_app_select ON app.%I FOR SELECT TO suhail_app USING(true)',t);
    EXECUTE format('CREATE POLICY research_app_insert ON app.%I FOR INSERT TO suhail_app WITH CHECK(true)',t);
    EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.research_append_only()',t);
    EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.research_append_only()',t);
  END LOOP;
END $$;
REVOKE ALL ON SEQUENCE app.research_staleness_event_id_seq FROM PUBLIC,suhail_public;
GRANT USAGE ON SEQUENCE app.research_staleness_event_id_seq TO suhail_app;