-- D-135: role defaults, not startup parameters ignored by transaction poolers.
-- Applies on new database sessions. Founder applies to Supabase separately.
ALTER ROLE suhail_app SET statement_timeout = '30s';
--> statement-breakpoint
ALTER ROLE suhail_app SET lock_timeout = '5s';
--> statement-breakpoint
ALTER ROLE suhail_app SET idle_in_transaction_session_timeout = '30s';
--> statement-breakpoint
ALTER ROLE suhail_public SET statement_timeout = '10s';
