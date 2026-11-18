-- D-216: P2 private research only. This migration never enables publishing.
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_requested';
--> statement-breakpoint
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_generated';
--> statement-breakpoint
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_edited';
--> statement-breakpoint
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_transition';
--> statement-breakpoint
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_settings';
--> statement-breakpoint
ALTER TYPE app.audit_event_type ADD VALUE IF NOT EXISTS 'research_gate';
--> statement-breakpoint
CREATE TABLE app.research_packet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid NOT NULL REFERENCES app.security(id),
  packet_schema_version text NOT NULL,
  packet_hash text NOT NULL,
  payload jsonb NOT NULL,
  built_at timestamptz NOT NULL
);
CREATE TABLE app.research_setting (
  id integer PRIMARY KEY DEFAULT 1 CHECK(id=1),
  ai_research_publishing boolean NOT NULL DEFAULT false,
  recommendation_wording text NOT NULL DEFAULT 'research_language' CHECK(recommendation_wording='research_language'),
  price_targets_enabled boolean NOT NULL DEFAULT false CHECK(NOT price_targets_enabled),
  monthly_token_budget bigint NOT NULL DEFAULT 0 CHECK(monthly_token_budget>=0),
  max_active_research_stocks integer NOT NULL DEFAULT 0 CHECK(max_active_research_stocks>=0),
  allowed_sectors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(allowed_sectors)='array'),
  max_packet_age_days integer CHECK(max_packet_age_days>0),
  max_financial_age_days integer CHECK(max_financial_age_days>0),
  price_move_threshold_percent numeric CHECK(price_move_threshold_percent>0),
  publication_age_days integer CHECK(publication_age_days>0),
  gate_decision_id text,
  gate_lawyer_answer_ref text,
  gate_enabled_by uuid,
  gate_enabled_at timestamptz,
  CONSTRAINT research_gate_evidence CHECK(NOT ai_research_publishing OR
    (gate_decision_id IS NOT NULL AND gate_decision_id ~ '^D-[0-9]+$'
     AND gate_lawyer_answer_ref IS NOT NULL AND length(trim(gate_lawyer_answer_ref))>0
     AND gate_enabled_by IS NOT NULL AND gate_enabled_at IS NOT NULL))
);
INSERT INTO app.research_setting(id) VALUES(1);
CREATE TABLE app.research_usage (
  month date PRIMARY KEY CHECK(extract(day FROM month)=1),
  used bigint NOT NULL DEFAULT 0 CHECK(used>=0),
  reserved bigint NOT NULL DEFAULT 0 CHECK(reserved>=0)
);
CREATE TABLE app.research_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid NOT NULL REFERENCES app.security(id),
  packet_id uuid NOT NULL REFERENCES app.research_packet(id),
  previous_draft_id uuid REFERENCES app.research_draft(id),
  state text NOT NULL DEFAULT 'requested' CHECK(state IN
    ('requested','generated','failed','in_review','changes_requested','edited','approved','rejected','published','updated','withdrawn')),
  ai_output jsonb,
  analyst_text jsonb,
  text_hash text,
  validation_text_hash text,
  validation_results jsonb NOT NULL DEFAULT '[{"check":"not_validated","severity":"block","message":"Validation required","location":"draft"}]',
  analyst_instructions text NOT NULL DEFAULT '' CHECK(length(analyst_instructions)<=2000),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK(input_tokens>=0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK(output_tokens>=0),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  model text,
  model_version text,
  prompt_version text NOT NULL,
  validator_version text NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_draft_stock_state ON app.research_draft(security_id,state);
CREATE TABLE app.research_review_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid REFERENCES app.research_draft(id),
  actor_id uuid NOT NULL,
  actor_role app.user_role NOT NULL CHECK(actor_role IN ('admin','editor')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  from_state text,
  to_state text,
  packet_hash text,
  model text,
  model_version text,
  prompt_version text NOT NULL,
  validator_version text NOT NULL,
  text_hash text,
  checklist jsonb,
  edit_reasons text[] NOT NULL DEFAULT '{}'
    CHECK(edit_reasons <@ ARRAY['tone','accuracy','too strong','missing risk','citation','compliance wording','other']::text[]),
  note text NOT NULL DEFAULT ''
);
--> statement-breakpoint
-- No public grants or policies: public cannot discover even approved drafts.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['research_packet','research_draft','research_review_event','research_setting','research_usage'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON app.%I FROM PUBLIC,suhail_public',t);
    EXECUTE format('CREATE POLICY research_app ON app.%I FOR ALL TO suhail_app USING(true) WITH CHECK(true)',t);
  END LOOP;
END $$;
GRANT SELECT,INSERT ON app.research_packet,app.research_review_event TO suhail_app;
GRANT SELECT,INSERT,UPDATE ON app.research_draft,app.research_usage TO suhail_app;
GRANT SELECT,UPDATE ON app.research_setting TO suhail_app;
--> statement-breakpoint
CREATE FUNCTION app.research_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN RAISE EXCEPTION 'research record is append-only'; END $$;
CREATE TRIGGER research_packet_immutable BEFORE UPDATE OR DELETE ON app.research_packet
FOR EACH ROW EXECUTE FUNCTION app.research_append_only();
CREATE TRIGGER research_packet_no_truncate BEFORE TRUNCATE ON app.research_packet
FOR EACH STATEMENT EXECUTE FUNCTION app.research_append_only();
CREATE TRIGGER research_review_event_immutable BEFORE UPDATE OR DELETE ON app.research_review_event
FOR EACH ROW EXECUTE FUNCTION app.research_append_only();
CREATE TRIGGER research_review_event_no_truncate BEFORE TRUNCATE ON app.research_review_event
FOR EACH STATEMENT EXECUTE FUNCTION app.research_append_only();
--> statement-breakpoint
CREATE FUNCTION app.research_transition_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
DECLARE allowed boolean; reviewed boolean;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'requested' OR NEW.ai_output IS NOT NULL OR NEW.analyst_text IS NOT NULL THEN
      RAISE EXCEPTION 'research drafts must start requested';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.packet_id IS DISTINCT FROM OLD.packet_id OR NEW.security_id IS DISTINCT FROM OLD.security_id
    OR NEW.previous_draft_id IS DISTINCT FROM OLD.previous_draft_id
    OR NEW.analyst_instructions IS DISTINCT FROM OLD.analyst_instructions THEN
    RAISE EXCEPTION 'research draft identity is immutable';
  END IF;
  IF OLD.ai_output IS NOT NULL AND NEW.ai_output IS DISTINCT FROM OLD.ai_output THEN
    RAISE EXCEPTION 'AI output is immutable';
  END IF;
  IF NEW.state IN ('published','updated','withdrawn') THEN
    RAISE EXCEPTION 'research publishing unavailable in P2';
  END IF;
  IF NEW.state=OLD.state AND NEW.analyst_text IS DISTINCT FROM OLD.analyst_text THEN
    RAISE EXCEPTION 'research edits require an edited transition';
  END IF;
  IF NEW.state<>OLD.state THEN
    allowed := (OLD.state='requested' AND NEW.state IN ('generated','failed'))
      OR (OLD.state='generated' AND NEW.state='in_review')
      OR (OLD.state='in_review' AND NEW.state IN ('changes_requested','edited','approved','rejected'))
      OR (OLD.state='changes_requested' AND NEW.state='edited')
      OR (OLD.state='edited' AND NEW.state='in_review');
    IF NOT allowed THEN RAISE EXCEPTION 'research transition refused'; END IF;
  END IF;
  IF NEW.state='approved' THEN
    IF NEW.analyst_text IS NULL OR NEW.text_hash IS NULL OR NEW.validation_text_hash IS DISTINCT FROM NEW.text_hash
      OR jsonb_typeof(NEW.validation_results)<>'array'
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.validation_results) i WHERE i->>'severity'='block') THEN
      RAISE EXCEPTION 'current research validation has blocking checks';
    END IF;
    SELECT EXISTS(
      SELECT 1 FROM app.research_review_event e
      JOIN app.users u ON u.id=e.actor_id AND u.role IN ('admin','editor')
      JOIN app.analyst_profile a ON a.user_id=u.id AND a.active
      WHERE e.draft_id=NEW.id AND e.to_state='approved' AND e.text_hash=NEW.text_hash
      AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['figures_checked','risks_adequate','wording_compliant',
        'shariah_context_correct','disclosure_present','analyst_view_confirmed']) k
        WHERE (e.checklist->k) IS DISTINCT FROM 'true'::jsonb)
    ) INTO reviewed;
    IF NOT reviewed THEN RAISE EXCEPTION 'active analyst and six review answers required'; END IF;
  END IF;
  NEW.updated_at=now();
  RETURN NEW;
END $$;
CREATE TRIGGER research_draft_transitions BEFORE INSERT OR UPDATE ON app.research_draft
FOR EACH ROW EXECUTE FUNCTION app.research_transition_guard();
REVOKE ALL ON FUNCTION app.research_append_only(),app.research_transition_guard() FROM PUBLIC,suhail_public;
GRANT EXECUTE ON FUNCTION app.research_append_only(),app.research_transition_guard() TO suhail_app;
