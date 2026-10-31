ALTER TABLE "app"."source" ADD COLUMN "production_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."methodology" ADD COLUMN "production_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."methodology_version" ADD COLUMN "production_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."business_segment" ADD CONSTRAINT "business_segment_share_fraction" CHECK ("app"."business_segment"."revenue_share" >= 0 AND "app"."business_segment"."revenue_share" <= 1);
--> statement-breakpoint
-- D-93: permanently preserve demo/synthetic provenance; metadata cannot relabel fixtures.
-- The new governance latch is metadata; all original content immutability remains.
CREATE OR REPLACE FUNCTION app.guard_methodology_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE allowed text[] := ARRAY['workflow_status','workflow_history','production_enabled','production_blocked','impact_report_id','test_report_id','approval_id','approved_by','approved_at','is_public','updated_at'];
BEGIN
  IF OLD.workflow_status <> 'draft' OR OLD.production_enabled THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'non-draft methodology version is immutable'; END IF;
    IF NEW.workflow_status = 'draft' THEN RAISE EXCEPTION 'methodology version cannot return to draft'; END IF;
    IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RAISE EXCEPTION 'non-draft methodology content is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION app.guard_methodology_criterion() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE state app.workflow_status; enabled boolean;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT workflow_status, production_enabled INTO state, enabled FROM app.methodology_version WHERE id = OLD.methodology_version_id FOR SHARE;
    IF state <> 'draft' OR enabled THEN RAISE EXCEPTION 'non-draft methodology criteria are immutable'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT workflow_status, production_enabled INTO state, enabled FROM app.methodology_version WHERE id = NEW.methodology_version_id FOR SHARE;
    IF state <> 'draft' OR enabled THEN RAISE EXCEPTION 'non-draft methodology criteria are immutable'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE FUNCTION app.guard_criterion_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.methodology_criterion c JOIN app.methodology_version v ON v.id = c.methodology_version_id
      WHERE v.workflow_status <> 'draft' OR v.production_enabled) THEN
    RAISE EXCEPTION 'non-draft methodology criteria are immutable';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app.guard_criterion_truncate() FROM PUBLIC, suhail_app, suhail_public;
-- Alphabetical trigger order ensures production_gate_lock runs before this check.
CREATE TRIGGER z_guard_criterion_truncate BEFORE TRUNCATE ON app.methodology_criterion FOR EACH STATEMENT EXECUTE FUNCTION app.guard_criterion_truncate();
UPDATE app.methodology SET production_blocked = true WHERE is_demo OR official_or_inspired = 'internal_example' OR slug IN ('ex-a','ex-b') OR short_label IN ('EX-A','EX-B');
UPDATE app.methodology_version SET production_blocked = true WHERE is_demo;
UPDATE app.source SET production_blocked = true WHERE is_demo OR is_synthetic OR source_type = 'internal';
CREATE FUNCTION app.latch_production_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.production_blocked THEN NEW.production_blocked := true; END IF;
  IF NEW.is_demo THEN NEW.production_blocked := true; END IF;
  IF TG_TABLE_NAME = 'methodology' THEN
    IF NEW.official_or_inspired = 'internal_example' OR NEW.slug IN ('ex-a','ex-b') OR NEW.short_label IN ('EX-A','EX-B') THEN NEW.production_blocked := true; END IF;
  ELSIF TG_TABLE_NAME = 'source' THEN
    IF NEW.is_synthetic OR NEW.source_type = 'internal' THEN NEW.production_blocked := true; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.latch_production_origin() FROM PUBLIC, suhail_app, suhail_public;
CREATE TRIGGER latch_production_origin BEFORE INSERT OR UPDATE ON app.methodology FOR EACH ROW EXECUTE FUNCTION app.latch_production_origin();
CREATE TRIGGER latch_production_origin BEFORE INSERT OR UPDATE ON app.methodology_version FOR EACH ROW EXECUTE FUNCTION app.latch_production_origin();
CREATE TRIGGER latch_production_origin BEFORE INSERT OR UPDATE ON app.source FOR EACH ROW EXECUTE FUNCTION app.latch_production_origin();
--> statement-breakpoint
-- D-10/D-12/D-72/D-93: metadata and same-version evidence, not an invented approval UI.
CREATE FUNCTION app.production_eligible(version_id uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
SELECT EXISTS (
  SELECT 1 FROM app.methodology_version v
  JOIN app.methodology m ON m.id = v.methodology_id
  JOIN app.methodology_version_report impact ON impact.id = v.impact_report_id AND impact.kind = 'impact' AND impact.methodology_version_id = v.id AND NOT impact.is_demo
  JOIN app.methodology_version_report test ON test.id = v.test_report_id AND test.kind = 'test' AND test.methodology_version_id = v.id AND NOT test.is_demo
   JOIN app.audit_event approval ON approval.id = v.approval_id AND approval.event_type = 'approval_recorded' AND approval.entity_name = 'methodology_version' AND approval.entity_id = v.id::text AND approval.actor_id = v.approved_by AND NOT approval.is_demo
   WHERE v.id = version_id AND NOT v.is_demo AND NOT v.production_blocked
     AND v.workflow_status = 'approved'
     AND EXISTS (SELECT 1 FROM app.methodology_criterion c WHERE c.methodology_version_id = v.id)
    AND NOT m.is_demo AND NOT m.production_blocked AND m.official_or_inspired <> 'internal_example'
    AND m.source_url ~ '^https://[^/[:space:]]+' AND length(btrim(m.source_title)) > 0
    AND length(btrim(m.verified_by)) > 0 AND m.verification_date IS NOT NULL
    AND v.approved_by IS NOT NULL AND v.approved_at IS NOT NULL
    AND cardinality(v.source_ids) > 0
    AND EXISTS (SELECT 1 FROM app.source s WHERE s.id = ANY(v.source_ids) AND s.source_url = m.source_url AND s.source_type = 'methodology_document' AND length(btrim(s.document_title)) > 0)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(v.source_ids) AS ref(source_id) LEFT JOIN app.source s ON s.id = ref.source_id
      WHERE s.id IS NULL OR s.is_demo OR s.is_synthetic OR s.production_blocked
        OR s.confidence_tier <> 'Verified' OR s.source_type = 'internal'
        OR s.source_url IS NULL OR s.source_url !~ '^https://[^/[:space:]]+'
    )
);
$$;
REVOKE ALL ON FUNCTION app.production_eligible(uuid) FROM PUBLIC, suhail_app, suhail_public;
--> statement-breakpoint
-- Serialize all prerequisite mutations before checking the cross-table invariant.
CREATE FUNCTION app.production_gate_lock() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Advisory serialization alone cannot refresh a REPEATABLE READ snapshot.
  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'production prerequisite writes require READ COMMITTED isolation';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(66420020);
  RETURN NULL;
END $$;
CREATE FUNCTION app.enforce_production_gate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.methodology m WHERE m.production_enabled AND
        (m.is_demo OR m.production_blocked OR NOT EXISTS (
         SELECT 1 FROM app.methodology_version v WHERE v.methodology_id = m.id AND app.production_eligible(v.id))))
    OR EXISTS (SELECT 1 FROM app.methodology_version v JOIN app.methodology m ON m.id = v.methodology_id
       WHERE v.production_enabled AND (NOT m.production_enabled OR NOT app.production_eligible(v.id))) THEN
    RAISE EXCEPTION 'production methodology gate: verified non-demo source, same-version reports and approval required';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app.production_gate_lock(), app.enforce_production_gate() FROM PUBLIC, suhail_app, suhail_public;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['methodology','methodology_version','methodology_criterion','source','methodology_version_report','audit_event'] LOOP
    EXECUTE format('CREATE TRIGGER production_gate_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.production_gate_lock()', table_name);
    EXECUTE format('CREATE TRIGGER enforce_production_gate AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.enforce_production_gate()', table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Refuse invalid pre-existing production state; never silently demote or repair it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.methodology m WHERE m.production_enabled AND
       (m.is_demo OR m.production_blocked OR NOT EXISTS (
         SELECT 1 FROM app.methodology_version v WHERE v.methodology_id = m.id AND app.production_eligible(v.id))))
    OR EXISTS (SELECT 1 FROM app.methodology_version v JOIN app.methodology m ON m.id = v.methodology_id
       WHERE v.production_enabled AND (NOT m.production_enabled OR NOT app.production_eligible(v.id))) THEN
    RAISE EXCEPTION 'hardening migration refuses pre-existing ineligible production methodology';
  END IF;
END $$;
--> statement-breakpoint
-- D-17: row triggers cannot see TRUNCATE; use a statement trigger on every history table.
CREATE FUNCTION app.reject_history_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'append-only table cannot be truncated'; END $$;
REVOKE ALL ON FUNCTION app.reject_history_truncate() FROM PUBLIC, suhail_app, suhail_public;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['screening_run','screening_criterion_result','screening_unknown','explanation_object','audit_event','edition_revision','editorial_approval','methodology_version_report'] LOOP
    EXECUTE format('CREATE TRIGGER reject_history_truncate BEFORE TRUNCATE ON app.%I FOR EACH STATEMENT EXECUTE FUNCTION app.reject_history_truncate()', table_name);
  END LOOP;
END $$;