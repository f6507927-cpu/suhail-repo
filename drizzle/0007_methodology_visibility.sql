-- D-102: fail rather than silently repair any pre-existing visibility violation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.methodology_version WHERE production_enabled AND NOT is_public)
     OR EXISTS (
       SELECT 1 FROM app.editorial_setting s
       JOIN app.methodology_version v ON v.id = s.default_shariah_methodology_version_id
       WHERE NOT v.is_public
     ) THEN
    RAISE EXCEPTION 'Publish production-enabled and editorial default versions before applying the visibility guard'
      USING ERRCODE = '23514';
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION app.guard_methodology_visibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.production_enabled AND NOT NEW.is_public THEN
    RAISE EXCEPTION 'A production-enabled version cannot be private; publish the version before enabling production'
      USING ERRCODE = '23514';
  END IF;
  IF NOT NEW.is_public AND EXISTS (
    SELECT 1 FROM app.editorial_setting
    WHERE default_shariah_methodology_version_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'The editorial default methodology version cannot be unpublished; select another default first'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.guard_methodology_visibility() FROM PUBLIC, suhail_app, suhail_public;
--> statement-breakpoint
CREATE TRIGGER guard_methodology_visibility BEFORE INSERT OR UPDATE ON app.methodology_version
FOR EACH ROW EXECUTE FUNCTION app.guard_methodology_visibility();
--> statement-breakpoint
-- Serialize default-pointer writes with the existing version/prerequisite lock.
CREATE TRIGGER production_gate_lock BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON app.editorial_setting
FOR EACH STATEMENT EXECUTE FUNCTION app.production_gate_lock();
--> statement-breakpoint
CREATE FUNCTION app.guard_default_methodology_visibility() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.default_shariah_methodology_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM app.methodology_version
    WHERE id = NEW.default_shariah_methodology_version_id AND is_public
  ) THEN
    RAISE EXCEPTION 'The editorial default methodology version must be public'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.guard_default_methodology_visibility() FROM PUBLIC, suhail_app, suhail_public;
--> statement-breakpoint
CREATE TRIGGER guard_default_methodology_visibility BEFORE INSERT OR UPDATE ON app.editorial_setting
FOR EACH ROW EXECUTE FUNCTION app.guard_default_methodology_visibility();