-- Operator-run daily cleanup; no hosted scheduler is installed by this migration.
CREATE FUNCTION app.cleanup_unmet_search() RETURNS bigint
LANGUAGE plpgsql
SET search_path = pg_catalog, app
AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM app.unmet_search
  WHERE calendar_day < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 90;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
--> statement-breakpoint
ALTER FUNCTION app.cleanup_unmet_search() OWNER TO postgres;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.cleanup_unmet_search() FROM PUBLIC, suhail_app, suhail_public;
