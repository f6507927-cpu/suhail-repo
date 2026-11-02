-- D-153: preparation only. Entirely unapplied, including to test databases.
ALTER TABLE app.price_bar ADD COLUMN price_provider text NOT NULL DEFAULT 'manual';
ALTER TABLE app.price_bar ADD COLUMN provider_updated_at timestamptz;
ALTER TABLE app.price_bar ADD CONSTRAINT price_bar_provider_check CHECK (
  price_provider = 'manual' OR (
    price_provider = 'API Ninjas' AND month_end_for IS NOT NULL
    AND provider_updated_at IS NOT NULL AND source_id IS NOT NULL
    AND source_label = 'API Ninjas' AND currency = 'USD' AND close > 0
    AND close < 1e24 AND NOT is_synthetic
    AND date_trunc('month', date)::date = date_trunc('month', month_end_for)::date
    AND month_end_for = (date_trunc('month', date) + interval '1 month - 1 day')::date
  )
);
CREATE UNIQUE INDEX price_bar_ninjas_month_unique
  ON app.price_bar (security_id, month_end_for) WHERE price_provider = 'API Ninjas';
--> statement-breakpoint
CREATE TABLE app.price_call_usage (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  used integer NOT NULL CHECK (used >= 0),
  cap integer NOT NULL CHECK (cap > 0)
);
CREATE TABLE app.price_target_claim (
  security_id uuid NOT NULL,
  month_end_for date NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_target_claim_unique UNIQUE (security_id, month_end_for),
  CONSTRAINT price_target_claim_security_id_security_id_fk FOREIGN KEY (security_id) REFERENCES app.security(id)
);
CREATE TABLE app.price_provider_status (
  provider text PRIMARY KEY CHECK (provider = 'API Ninjas'),
  reason text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE app.price_call_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.price_target_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.price_provider_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.price_call_usage, app.price_target_claim, app.price_provider_status FROM PUBLIC, suhail_public;
GRANT SELECT, INSERT, UPDATE ON app.price_call_usage, app.price_provider_status TO suhail_app;
GRANT SELECT, INSERT ON app.price_target_claim TO suhail_app;
CREATE POLICY app_usage ON app.price_call_usage FOR ALL TO suhail_app USING (true) WITH CHECK (true);
CREATE POLICY app_claim ON app.price_target_claim FOR ALL TO suhail_app USING (true) WITH CHECK (true);
CREATE POLICY app_status ON app.price_provider_status FOR ALL TO suhail_app USING (true) WITH CHECK (true);
-- Only these new price columns, not bookkeeping or provider status, are public.
GRANT SELECT (price_provider, month_end_for, source_id, source_url) ON app.price_bar TO suhail_public;
CREATE POLICY public_price_source_read ON app.source FOR SELECT TO suhail_public USING (
  EXISTS (SELECT 1 FROM app.price_bar p JOIN app.security s ON s.id = p.security_id
    WHERE p.source_id = source.id AND s.in_universe AND s.listing_status = 'listed')
);
