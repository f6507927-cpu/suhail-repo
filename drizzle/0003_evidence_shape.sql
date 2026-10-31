-- D-75: keep editor evidence structured even for direct application-role SQL.
CREATE OR REPLACE FUNCTION app.check_editor_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(NEW.editor_evidence) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'editor evidence must be an array';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(NEW.editor_evidence) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item -> 'claim_ar') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item -> 'source_id') IS DISTINCT FROM 'string'
      OR (item ->> 'source_id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      OR NOT (item ? 'value')
      OR (item ? 'claim_en' AND jsonb_typeof(item -> 'claim_en') NOT IN ('string','null')) THEN
      RAISE EXCEPTION 'editor evidence requires claim_ar, optional claim_en, UUID source_id and value';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.check_editor_evidence() FROM PUBLIC, suhail_public, suhail_app;
DROP TRIGGER IF EXISTS check_editor_evidence ON app.pick;
CREATE TRIGGER check_editor_evidence BEFORE INSERT OR UPDATE ON app.pick FOR EACH ROW EXECUTE FUNCTION app.check_editor_evidence();