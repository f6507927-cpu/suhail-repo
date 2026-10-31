-- D-47: expose only enrollment, not factor secrets or another user's session AAL.
-- Managed Supabase auth.mfa_factors columns used: user_id, factor_type, status.
-- PL/pgSQL resolves managed auth relations at invocation, not plain-PG migration time.
CREATE OR REPLACE FUNCTION app.verified_totp_status(p_ids uuid[])
RETURNS TABLE(user_id uuid, verified_totp boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF pg_catalog.cardinality(p_ids) > 25 THEN
    RAISE EXCEPTION 'projection limited to one users page';
  END IF;
  RETURN QUERY SELECT u.id, EXISTS (
    SELECT 1 FROM auth.mfa_factors f
    WHERE f.user_id = u.id AND f.factor_type::text = 'totp' AND f.status::text = 'verified'
  ) FROM app.users u WHERE u.id = ANY(p_ids);
END $$;
ALTER FUNCTION app.verified_totp_status(uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION app.verified_totp_status(uuid[]) FROM PUBLIC, suhail_public;
GRANT EXECUTE ON FUNCTION app.verified_totp_status(uuid[]) TO suhail_app;
--> statement-breakpoint
-- D-50: extend privileged deletion refusal to editors without changing historical audit.
CREATE OR REPLACE FUNCTION app.delete_own_account(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE account_role app.user_role;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(73501947);
  SELECT role INTO account_role FROM app.users WHERE id = p_user_id FOR UPDATE;
  IF account_role IN ('admin','editor') THEN RAISE EXCEPTION 'privileged users must be demoted before account deletion'; END IF;
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
