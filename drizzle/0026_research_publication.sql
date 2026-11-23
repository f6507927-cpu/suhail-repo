ALTER TYPE "app"."audit_event_type" ADD VALUE 'research_publication';--> statement-breakpoint
CREATE TABLE "app"."research_publication_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"security_id" uuid NOT NULL,
	"draft_id" uuid NOT NULL,
	"analyst_profile_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"approval_at" timestamp with time zone NOT NULL,
	"data_as_of" date NOT NULL,
	"triggers" text[] DEFAULT '{}' NOT NULL,
	"withdrawal_reason" text,
	"display" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."research_publication_event" ADD CONSTRAINT "research_publication_event_security_id_security_id_fk" FOREIGN KEY ("security_id") REFERENCES "app"."security"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."research_publication_event" ADD CONSTRAINT "research_publication_event_draft_id_research_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "app"."research_draft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."research_publication_event" ADD CONSTRAINT "research_publication_event_analyst_profile_id_analyst_profile_id_fk" FOREIGN KEY ("analyst_profile_id") REFERENCES "app"."analyst_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_publication_stock_event" ON "app"."research_publication_event" USING btree ("security_id","id" DESC NULLS LAST);
--> statement-breakpoint
ALTER TABLE app.research_publication_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.research_publication_event, app.research_publication_event_id_seq FROM PUBLIC,suhail_public,suhail_app;
GRANT SELECT,INSERT ON app.research_publication_event TO suhail_app;
GRANT USAGE ON app.research_publication_event_id_seq TO suhail_app;
CREATE POLICY research_publication_app_read ON app.research_publication_event FOR SELECT TO suhail_app USING(true);
CREATE POLICY research_publication_app_insert ON app.research_publication_event FOR INSERT TO suhail_app WITH CHECK(true);
CREATE TRIGGER research_publication_immutable BEFORE UPDATE OR DELETE ON app.research_publication_event
FOR EACH ROW EXECUTE FUNCTION app.research_append_only();
CREATE TRIGGER research_publication_no_truncate BEFORE TRUNCATE ON app.research_publication_event
FOR EACH STATEMENT EXECUTE FUNCTION app.research_append_only();
--> statement-breakpoint
CREATE FUNCTION app.research_publishing_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,app
AS $$ SELECT coalesce((SELECT ai_research_publishing FROM app.research_setting WHERE id=1),false) $$;
REVOKE ALL ON FUNCTION app.research_publishing_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.research_publishing_enabled() TO suhail_public,suhail_app;
--> statement-breakpoint
CREATE VIEW app.research_publication_current AS
SELECT DISTINCT ON (security_id) id,security_id,draft_id,analyst_profile_id,kind,approval_at,data_as_of,triggers,
  withdrawal_reason,display,occurred_at
FROM app.research_publication_event ORDER BY security_id,id DESC;
REVOKE ALL ON app.research_publication_current FROM PUBLIC,suhail_public;
GRANT SELECT ON app.research_publication_current TO suhail_app;
--> statement-breakpoint
-- Publication is a separate state machine on immutable approved drafts. Keep
-- the private draft trigger's direct-write refusal so no caller can bypass it.
CREATE FUNCTION app.research_publication_transition_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
DECLARE d app.research_draft%ROWTYPE; p app.research_packet%ROWTYPE;
  config app.research_setting%ROWTYPE; current_row app.research_publication_current%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(73501948);
  SELECT * INTO config FROM app.research_setting WHERE id=1 FOR SHARE;
  IF NOT coalesce(config.ai_research_publishing,false) THEN RAISE EXCEPTION 'research publishing gate is off'; END IF;
  IF NOT EXISTS (SELECT 1 FROM app.users u JOIN app.analyst_profile a ON a.user_id=u.id
    WHERE u.id=NEW.actor_id AND u.role='admin' AND a.active) THEN
    RAISE EXCEPTION 'research publication requires an active analyst administrator';
  END IF;
  SELECT * INTO d FROM app.research_draft WHERE id=NEW.draft_id FOR SHARE;
  IF d.id IS NULL OR d.state<>'approved' OR d.text_hash IS NULL OR d.analyst_text IS NULL
    OR d.text_hash IS DISTINCT FROM d.validation_text_hash OR jsonb_typeof(d.validation_results)<>'array'
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(d.validation_results) i WHERE i->>'severity'='block') THEN
    RAISE EXCEPTION 'research publication requires a current approved draft without blocking checks';
  END IF;
  SELECT a.id,e.occurred_at INTO NEW.analyst_profile_id,NEW.approval_at
    FROM app.research_review_event e JOIN app.analyst_profile a ON a.user_id=e.actor_id AND a.active
    WHERE e.draft_id=d.id AND e.to_state='approved' AND e.text_hash=d.text_hash
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1;
  IF NEW.analyst_profile_id IS NULL THEN RAISE EXCEPTION 'research publication requires an active approving analyst'; END IF;
  SELECT * INTO p FROM app.research_packet WHERE id=d.packet_id;
  NEW.security_id := d.security_id;
  NEW.data_as_of := (p.payload#>>'{periods,0,period_end}')::date;
  NEW.occurred_at := statement_timestamp();
  IF EXISTS (SELECT 1 FROM (SELECT outdated FROM app.research_staleness_event
    WHERE draft_id=d.id ORDER BY id DESC LIMIT 1) flag WHERE flag.outdated) THEN
    RAISE EXCEPTION 'research draft is outdated';
  END IF;
  IF config.max_packet_age_days IS NULL OR config.max_financial_age_days IS NULL OR NEW.data_as_of IS NULL
    OR p.built_at>NEW.occurred_at OR p.built_at<NEW.occurred_at-make_interval(days=>config.max_packet_age_days)
    OR NEW.data_as_of>(NEW.occurred_at AT TIME ZONE 'UTC')::date
    OR (NEW.occurred_at AT TIME ZONE 'UTC')::date-NEW.data_as_of>config.max_financial_age_days THEN
    RAISE EXCEPTION 'research publication freshness check failed';
  END IF;
  SELECT * INTO current_row FROM app.research_publication_current WHERE security_id=d.security_id;
  NEW.triggers := '{}';
  CASE NEW.kind
    WHEN 'published' THEN
      IF current_row.id IS NOT NULL AND current_row.kind<>'withdrawn' THEN
        RAISE EXCEPTION 'use an approved refresh to update current research';
      END IF;
    WHEN 'updated' THEN
      IF current_row.id IS NULL OR current_row.kind='withdrawn' OR d.previous_draft_id IS DISTINCT FROM current_row.draft_id
        OR NOT EXISTS(SELECT 1 FROM app.research_refresh WHERE draft_id=d.id) THEN
        RAISE EXCEPTION 'update must be an approved refresh of the current publication';
      END IF;
      SELECT coalesce(array_agg(DISTINCT c->>'trigger' ORDER BY c->>'trigger'),'{}') INTO NEW.triggers
        FROM app.research_refresh r CROSS JOIN LATERAL jsonb_array_elements(r.changes) c
        WHERE r.draft_id=d.id AND c->>'trigger' IN ('new_filing','identity_change','derived_change','status_change','price_move','age');
      IF cardinality(NEW.triggers)=0 THEN RAISE EXCEPTION 'research refresh requires a stored change reason'; END IF;
    WHEN 'withdrawn' THEN
      IF current_row.id IS NULL OR current_row.kind='withdrawn' OR current_row.draft_id<>d.id
        OR coalesce(NEW.withdrawal_reason,'') NOT IN ('evidence_corrected','no_longer_current','editorial_withdrawal') THEN
        RAISE EXCEPTION 'withdrawal requires the current publication and a withdrawal reason';
      END IF;
      NEW.display := '{}';
    ELSE RAISE EXCEPTION 'research publication transition refused';
  END CASE;
  IF NEW.kind<>'withdrawn' THEN
    IF NEW.withdrawal_reason IS NOT NULL OR coalesce(jsonb_typeof(NEW.display->'plain_summary'),'')<>'array'
      OR jsonb_array_length(NEW.display->'plain_summary')<>3 THEN
      RAISE EXCEPTION 'research publication requires the approved public display';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.research_publication_transition_guard() FROM PUBLIC,suhail_public;
GRANT EXECUTE ON FUNCTION app.research_publication_transition_guard() TO suhail_app;
CREATE TRIGGER research_publication_transitions BEFORE INSERT ON app.research_publication_event
FOR EACH ROW EXECUTE FUNCTION app.research_publication_transition_guard();
--> statement-breakpoint
CREATE FUNCTION app.research_public_bilingual(value jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,app AS $$
  SELECT jsonb_build_object('ar',value->>'ar','en',value->>'en')
$$;
CREATE FUNCTION app.research_public_lines(lines jsonb) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,app AS $$
  SELECT coalesce(jsonb_agg(app.research_public_bilingual(line) ORDER BY ordinal),'[]')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(lines)='array' THEN lines ELSE '[]' END)
    WITH ORDINALITY AS rendered(line,ordinal)
$$;
REVOKE ALL ON FUNCTION app.research_public_bilingual(jsonb),app.research_public_lines(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.research_public_bilingual(jsonb),app.research_public_lines(jsonb) TO suhail_public;
--> statement-breakpoint
-- Do not expose a draft ID, raw JSON document, user row, or private view.
CREATE VIEW app.public_stock_research WITH (security_barrier=true) AS
SELECT s.slug, app.research_public_lines(p.display->'plain_summary') AS plain_summary,
  CASE WHEN live.status='passes_selected_methodology' AND NOT coalesce(flag.analyst_view_review_required,false)
    AND (live.stop_id IS NULL OR (flag.cleared_version_id=live.version_id AND flag.cleared_stop_id=live.stop_id))
    THEN jsonb_build_object(
      'thesis',app.research_public_lines(p.display#>'{analyst_view,thesis}'),
      'evidence',app.research_public_lines(p.display#>'{analyst_view,evidence}'),
      'risks',app.research_public_lines(p.display#>'{analyst_view,risks}'),
      'valuation',app.research_public_bilingual(p.display#>'{analyst_view,valuation}')) END AS analyst_view,
  a.name_ar,a.name_en,a.title_ar,a.title_en,a.credentials,a.headshot_object_key,a.bio_ar,a.bio_en,
  p.approval_at,p.data_as_of,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('slug',r->>'slug','label',r->>'label','status',r->>'status') ORDER BY ordinal),'[]')
   FROM jsonb_array_elements(p.display->'methodologies') WITH ORDINALITY AS method(r,ordinal)) AS methodologies,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',r->>'source_id','label',r->>'label') ORDER BY ordinal),'[]')
   FROM jsonb_array_elements(p.display->'citations') WITH ORDINALITY AS citation(r,ordinal)) AS citations,
  p.triggers AS update_codes, CASE WHEN p.kind='updated' THEN p.occurred_at END AS updated_at,
  CASE WHEN flag.outdated THEN flag.outdated_reasons ELSE '{}'::text[] END AS outdated_codes,
  CASE WHEN flag.outdated THEN flag.occurred_at END AS outdated_at
FROM app.research_publication_current p
JOIN app.security s ON s.id=p.security_id AND s.in_universe AND s.listing_status='listed' AND NOT s.is_demo
JOIN app.company c ON c.id=s.company_id AND NOT c.is_demo
JOIN app.analyst_profile a ON a.id=p.analyst_profile_id AND a.active AND NOT a.is_demo
JOIN app.research_draft d ON d.id=p.draft_id
JOIN app.research_packet packet ON packet.id=d.packet_id
LEFT JOIN LATERAL (
  SELECT f.* FROM app.research_staleness_event f WHERE f.draft_id=d.id ORDER BY id DESC LIMIT 1
) flag ON true
LEFT JOIN LATERAL (
  SELECT r.status,v.id AS version_id,(
    SELECT stop.id FROM app.screening_run stop WHERE stop.security_id=s.id AND stop.methodology_version_id=v.id
      AND NOT stop.is_demo AND stop.status<>'passes_selected_methodology'
      AND stop.generated_at>=coalesce((
        SELECT max((item->>'run_at')::timestamptz) FROM jsonb_array_elements(packet.payload->'screenings') item
        WHERE item->>'methodology'=m.slug AND item->>'status'='passes_selected_methodology'
      ),p.approval_at)
    ORDER BY stop.generated_at DESC,stop.id DESC LIMIT 1
  ) AS stop_id
  FROM app.public_settings settings JOIN app.methodology_version v ON v.id=settings.default_shariah_methodology_version_id
  JOIN app.methodology m ON m.id=v.methodology_id
  JOIN app.screening_run r ON r.methodology_version_id=v.id AND r.security_id=s.id
  WHERE NOT r.is_demo AND m.production_enabled AND v.production_enabled
    AND NOT m.is_demo AND NOT v.is_demo AND NOT m.production_blocked AND NOT v.production_blocked
  ORDER BY r.generated_at DESC,(r.status<>'passes_selected_methodology') DESC,r.id DESC LIMIT 1
) live ON true
WHERE app.research_publishing_enabled() AND p.kind IN ('published','updated') AND d.state='approved';
ALTER VIEW app.public_stock_research OWNER TO postgres;
REVOKE ALL ON app.public_stock_research FROM PUBLIC;
GRANT SELECT ON app.public_stock_research TO suhail_public;