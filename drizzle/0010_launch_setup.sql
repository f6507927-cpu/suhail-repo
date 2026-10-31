CREATE TABLE "app"."unmet_search" (
	"normalized_query" text NOT NULL,
	"calendar_day" date NOT NULL,
	"count" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "unmet_search_normalized_query_calendar_day_pk" PRIMARY KEY("normalized_query","calendar_day"),
	CONSTRAINT "unmet_search_query_length" CHECK (length("app"."unmet_search"."normalized_query") BETWEEN 1 AND 40),
	CONSTRAINT "unmet_search_count_positive" CHECK ("app"."unmet_search"."count" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."financial_fact" ADD COLUMN "shares_class_concern" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE app.unmet_search ENABLE ROW LEVEL SECURITY;
CREATE POLICY unmet_search_app ON app.unmet_search TO suhail_app USING (true);
-- Default privileges would otherwise grant ordinary application mutations.
REVOKE ALL ON app.unmet_search FROM suhail_app;
GRANT SELECT ON app.unmet_search TO suhail_app;
REVOKE ALL ON app.unmet_search FROM PUBLIC, suhail_public;
--> statement-breakpoint
-- Public connections can increment only today's normalized aggregate, never read
-- the table or choose a count/day. No request identity or fine timestamp retained.
CREATE FUNCTION app.record_unmet_search(query text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, app AS $$
DECLARE normalized text;
BEGIN
  normalized := lower(regexp_replace(translate(btrim(query), 'أإآةىـ', 'اااهي'), '[ؐ-ًؚ-ٰٟۖ-ۭ]', '', 'g'));
  IF normalized IS NULL OR length(normalized) NOT BETWEEN 1 AND 40 THEN RETURN; END IF;
  INSERT INTO app.unmet_search(normalized_query, calendar_day, count)
    VALUES (normalized, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (normalized_query, calendar_day)
    DO UPDATE SET count = app.unmet_search.count + 1;
END;
$$;
REVOKE ALL ON FUNCTION app.record_unmet_search(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_unmet_search(text) TO suhail_public;