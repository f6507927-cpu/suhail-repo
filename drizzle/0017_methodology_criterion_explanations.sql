-- D-147: plain UI explanations, not calculation inputs or stored reasons.
ALTER TABLE app.methodology_criterion ADD COLUMN explanation_ar text;
--> statement-breakpoint
ALTER TABLE app.methodology_criterion ADD COLUMN explanation_en text;
--> statement-breakpoint
-- Public access is explicitly column-granted; existing version RLS and the
-- finalized-criterion immutability trigger continue to apply to these columns.
GRANT SELECT (explanation_ar, explanation_en) ON app.methodology_criterion TO suhail_public;
