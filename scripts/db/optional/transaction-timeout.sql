-- OPTIONAL / NOT part of drizzle's migration journal. Founder reviews/applies.
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'ALTER ROLE suhail_app SET transaction_timeout = ''60s''';
    RAISE NOTICE 'Applied suhail_app transaction_timeout=60s; new backend sessions required';
  ELSE
    RAISE NOTICE 'Skipped: transaction_timeout is not supported below PostgreSQL 17';
  END IF;
END;
$$;
