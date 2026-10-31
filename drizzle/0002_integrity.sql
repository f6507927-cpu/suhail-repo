-- D-17: no owner-level ordinary UPDATE/DELETE escape, including FK actions.
CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'append-only table % rejects %', TG_TABLE_NAME, TG_OP; END $$;
REVOKE ALL ON FUNCTION app.reject_mutation() FROM PUBLIC, suhail_public, suhail_app;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['screening_run','screening_criterion_result','screening_unknown','explanation_object','audit_event','edition_revision','editorial_approval','methodology_version_report'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS reject_mutation ON app.%I', t);
    EXECUTE format('CREATE TRIGGER reject_mutation BEFORE UPDATE OR DELETE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.reject_mutation()', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app.touch_updated_at() FROM PUBLIC, suhail_public, suhail_app;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','analyst_profile','exchange','company','security','source','financial_period','financial_fact','business_segment','price_bar','methodology','methodology_version','methodology_criterion','edition','pick','editorial_setting','job_run'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON app.%I', t);
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- D-11: compare all content, not a list of currently known content fields.
CREATE OR REPLACE FUNCTION app.guard_methodology_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE allowed text[] := ARRAY['workflow_status','workflow_history','production_enabled','impact_report_id','test_report_id','approval_id','approved_by','approved_at','is_public','updated_at'];
BEGIN
  IF OLD.workflow_status <> 'draft' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'non-draft methodology version is immutable'; END IF;
    IF NEW.workflow_status = 'draft' THEN RAISE EXCEPTION 'methodology version cannot return to draft'; END IF;
    IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RAISE EXCEPTION 'non-draft methodology content is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.guard_methodology_version() FROM PUBLIC, suhail_public, suhail_app;
DROP TRIGGER IF EXISTS guard_methodology_version ON app.methodology_version;
CREATE TRIGGER guard_methodology_version BEFORE UPDATE OR DELETE ON app.methodology_version FOR EACH ROW EXECUTE FUNCTION app.guard_methodology_version();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.guard_methodology_criterion() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE state app.workflow_status;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT workflow_status INTO state FROM app.methodology_version WHERE id = OLD.methodology_version_id FOR SHARE;
    IF state <> 'draft' THEN RAISE EXCEPTION 'non-draft methodology criteria are immutable'; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT workflow_status INTO state FROM app.methodology_version WHERE id = NEW.methodology_version_id FOR SHARE;
    IF state <> 'draft' THEN RAISE EXCEPTION 'non-draft methodology criteria are immutable'; END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION app.guard_methodology_criterion() FROM PUBLIC, suhail_public, suhail_app;
DROP TRIGGER IF EXISTS guard_methodology_criterion ON app.methodology_criterion;
CREATE TRIGGER guard_methodology_criterion BEFORE INSERT OR UPDATE OR DELETE ON app.methodology_criterion FOR EACH ROW EXECUTE FUNCTION app.guard_methodology_criterion();
--> statement-breakpoint
-- D-72 approval must be an approval event, not just any valid audit FK.
CREATE OR REPLACE FUNCTION app.check_version_references() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.approval_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.audit_event WHERE id = NEW.approval_id AND event_type = 'approval_recorded') THEN
    RAISE EXCEPTION 'approval_id must reference approval_recorded';
  END IF;
  IF NEW.impact_report_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.methodology_version_report WHERE id = NEW.impact_report_id AND kind = 'impact' AND methodology_version_id = NEW.id) THEN
    RAISE EXCEPTION 'impact report must belong to version';
  END IF;
  IF NEW.test_report_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.methodology_version_report WHERE id = NEW.test_report_id AND kind = 'test' AND methodology_version_id = NEW.id) THEN
    RAISE EXCEPTION 'test report must belong to version';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.check_version_references() FROM PUBLIC, suhail_public, suhail_app;
DROP TRIGGER IF EXISTS check_version_references ON app.methodology_version;
CREATE TRIGGER check_version_references BEFORE INSERT OR UPDATE ON app.methodology_version FOR EACH ROW EXECUTE FUNCTION app.check_version_references();
--> statement-breakpoint
-- D-76: end-user audit records contain only UUID identity and fixed metadata.
CREATE OR REPLACE FUNCTION app.check_user_audit_privacy() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.event_type IN ('user_registered','consent_recorded','user_account_deleted') THEN
    IF NEW.actor_email IS NOT NULL OR NEW.details IS NOT NULL
      OR NEW.summary <> NEW.event_type::text OR NEW.entity_name IS DISTINCT FROM 'users'
      OR NEW.actor_role IS NOT NULL OR NEW.entity_id IS NULL
      OR NEW.entity_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR (NEW.actor_id IS NOT NULL AND NEW.actor_id::text <> lower(NEW.entity_id))
      OR (NEW.created_by IS NOT NULL AND NEW.created_by::text <> lower(NEW.entity_id)) THEN
      RAISE EXCEPTION 'end-user audit event must store user ID only';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.check_user_audit_privacy() FROM PUBLIC, suhail_public, suhail_app;
DROP TRIGGER IF EXISTS check_user_audit_privacy ON app.audit_event;
CREATE TRIGGER check_user_audit_privacy BEFORE INSERT ON app.audit_event FOR EACH ROW EXECUTE FUNCTION app.check_user_audit_privacy();
--> statement-breakpoint
-- D-76/D-50: comments on EVERY immutable user UUID, no user foreign keys.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['screening_run','screening_criterion_result','screening_unknown','explanation_object','audit_event','edition_revision','editorial_approval','methodology_version_report','methodology_version','methodology_criterion'] LOOP
    EXECUTE format('COMMENT ON COLUMN app.%I.created_by IS %L', t, 'D-76 / D-50: historical user UUID without FK; account deletion must not mutate immutable rows.');
  END LOOP;
END $$;
COMMENT ON COLUMN app.audit_event.actor_id IS 'D-76 / D-50: historical actor UUID without FK; survives account deletion unchanged.';
COMMENT ON COLUMN app.editorial_approval.approver_id IS 'D-76 / D-50: historical approver UUID without FK; survives account deletion unchanged.';
COMMENT ON COLUMN app.methodology_version.approved_by IS 'D-76 / D-50: historical approver UUID without FK; survives account deletion unchanged.';
COMMENT ON COLUMN app.methodology_version_report.author_id IS 'D-76 / D-50: historical author UUID without FK; survives account deletion unchanged.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.delete_own_account(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_role app.user_role;
BEGIN
  SELECT role INTO account_role FROM app.users WHERE id = p_user_id FOR UPDATE;
  IF account_role = 'admin' THEN RAISE EXCEPTION 'admins must be demoted before account deletion'; END IF;
  -- Supabase is deliberately not needed to apply migrations to plain Postgres.
  IF pg_catalog.to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.users WHERE id = $1' USING p_user_id;
  END IF;
  DELETE FROM app.users WHERE id = p_user_id;
  IF account_role IS NOT NULL THEN
    INSERT INTO app.audit_event (event_type, entity_name, entity_id, summary, actor_id)
    VALUES ('user_account_deleted','users',p_user_id::text,'user_account_deleted',p_user_id);
  END IF;
END $$;
ALTER FUNCTION app.delete_own_account(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION app.delete_own_account(uuid) FROM PUBLIC, suhail_public;
GRANT EXECUTE ON FUNCTION app.delete_own_account(uuid) TO suhail_app;