-- D-156: append-only analyst-case definitions before tests_passed.
-- No criteria/content edits, workflow reset/advance or report changes accompany an append.
CREATE OR REPLACE FUNCTION app.guard_methodology_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  allowed text[] := ARRAY['workflow_status','workflow_history','production_enabled','production_blocked','impact_report_id','test_report_id','approval_id','approved_by','approved_at','is_public','updated_at'];
  old_count integer;
BEGIN
  IF OLD.workflow_status <> 'draft' OR OLD.production_enabled THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'non-draft methodology version is immutable'; END IF;
    IF NEW.workflow_status = 'draft' THEN RAISE EXCEPTION 'methodology version cannot return to draft'; END IF;
    IF NEW.analyst_test_cases IS DISTINCT FROM OLD.analyst_test_cases THEN
      IF OLD.workflow_status NOT IN ('source_verified', 'rules_normalized') OR OLD.production_enabled
        OR (to_jsonb(NEW) - ARRAY['analyst_test_cases','updated_at']) IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['analyst_test_cases','updated_at']) THEN
        RAISE EXCEPTION 'analyst cases may only be appended before tests_passed without other changes';
      END IF;
      IF jsonb_typeof(OLD.analyst_test_cases) IS DISTINCT FROM 'array'
        OR jsonb_typeof(NEW.analyst_test_cases) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'analyst cases must be arrays';
      END IF;
      old_count := jsonb_array_length(OLD.analyst_test_cases);
      IF jsonb_array_length(NEW.analyst_test_cases) <= old_count
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(OLD.analyst_test_cases) WITH ORDINALITY AS previous(value, n)
          WHERE NEW.analyst_test_cases -> (previous.n::integer - 1) IS DISTINCT FROM previous.value
        ) THEN
        RAISE EXCEPTION 'existing analyst cases cannot be edited, removed or reordered';
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.analyst_test_cases) WITH ORDINALITY AS added(value, n)
        WHERE added.n > old_count AND (
          jsonb_typeof(added.value) IS DISTINCT FROM 'object'
          OR jsonb_typeof(added.value -> 'name') IS DISTINCT FROM 'string'
          OR btrim(coalesce(added.value ->> 'name', '')) = ''
          OR jsonb_typeof(added.value -> 'inputs') IS DISTINCT FROM 'object'
          OR jsonb_typeof(added.value -> 'expected') IS DISTINCT FROM 'object'
        )
      ) THEN
        RAISE EXCEPTION 'invalid analyst case structure';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(NEW.analyst_test_cases) WITH ORDINALITY AS added(value, n)
        JOIN jsonb_array_elements(NEW.analyst_test_cases) WITH ORDINALITY AS previous(value, n)
          ON previous.n < added.n
        WHERE added.n > old_count AND (
          added.value ->> 'name' = previous.value ->> 'name'
          OR (added.value -> 'inputs' = previous.value -> 'inputs'
            AND added.value -> 'expected' = previous.value -> 'expected')
        )
      ) THEN
        RAISE EXCEPTION 'duplicate analyst cases cannot be appended';
      END IF;
      allowed := array_append(allowed, 'analyst_test_cases');
    END IF;
    IF (to_jsonb(NEW) - allowed) IS DISTINCT FROM (to_jsonb(OLD) - allowed) THEN
      RAISE EXCEPTION 'non-draft methodology content is immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
