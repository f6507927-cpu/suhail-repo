CREATE TABLE "app"."stock_request" (
	"user_id" uuid NOT NULL,
	"normalized_query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_request_user_id_normalized_query_pk" PRIMARY KEY("user_id","normalized_query"),
	CONSTRAINT "stock_request_query_length" CHECK (length("app"."stock_request"."normalized_query") BETWEEN 1 AND 40)
);
--> statement-breakpoint
ALTER TABLE "app"."stock_request" ADD CONSTRAINT "stock_request_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_request_query_idx" ON "app"."stock_request" USING btree ("normalized_query");--> statement-breakpoint
-- Earlier hand-written migrations already added the fields in 0016/0017.
-- This migration adds ONLY request storage. The new snapshot reconciles those
-- existing schema definitions without replaying their DDL.
ALTER TABLE app.stock_request ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.stock_request FROM PUBLIC,suhail_public;
GRANT SELECT,INSERT,DELETE ON app.stock_request TO suhail_app;
CREATE POLICY app_stock_requests ON app.stock_request FOR ALL TO suhail_app USING(true) WITH CHECK(true);
--> statement-breakpoint
CREATE FUNCTION app.enforce_stock_request_limit() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN
  -- REPEATABLE READ cannot refresh the count snapshot after waiting for the
  -- account lock. Fail closed rather than permit a stale-count cap bypass.
  IF current_setting('transaction_isolation')='repeatable read' THEN
    RAISE EXCEPTION USING ERRCODE='0A000',MESSAGE='stock_request_isolation_unsupported';
  END IF;
  -- Serialize all inserts for one account, including concurrent transactions.
  PERFORM 1 FROM app.users WHERE id=NEW.user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM app.stock_request
    WHERE user_id=NEW.user_id AND normalized_query=NEW.normalized_query) THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM app.stock_request WHERE user_id=NEW.user_id)>=20 THEN
    RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='stock_request_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.enforce_stock_request_limit() FROM PUBLIC,suhail_public;
GRANT EXECUTE ON FUNCTION app.enforce_stock_request_limit() TO suhail_app;
CREATE TRIGGER stock_request_limit BEFORE INSERT ON app.stock_request
FOR EACH ROW EXECUTE FUNCTION app.enforce_stock_request_limit();