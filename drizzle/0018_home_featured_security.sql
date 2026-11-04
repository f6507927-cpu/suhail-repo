-- D-146 / D-36: selection is deliberately NULL; never activate from a migration.
ALTER TABLE app.editorial_setting ADD COLUMN featured_security_id uuid REFERENCES app.security(id);
--> statement-breakpoint
CREATE OR REPLACE VIEW app.public_settings WITH (security_barrier = true) AS
  SELECT default_shariah_methodology_version_id, featured_security_id
  FROM app.editorial_setting WHERE setting_key = 'editorial';
ALTER VIEW app.public_settings OWNER TO postgres;
REVOKE ALL ON app.public_settings FROM PUBLIC;
GRANT SELECT ON app.public_settings TO suhail_public, suhail_app;
--> statement-breakpoint
-- D-29 / D-151: resolve the actual author's active profile without granting
-- anonymous access to pick.created_by, user_id or author email. Public pick and
-- profile RLS still apply at the calling query; this view reveals only IDs.
CREATE VIEW app.public_pick_analyst WITH (security_barrier = true) AS
  SELECT p.id AS pick_id, a.id AS analyst_id
  FROM app.pick p
  JOIN app.edition e ON e.id = p.edition_id
  JOIN app.analyst_profile a ON a.user_id = p.created_by AND a.active
  WHERE p.pick_type = 'editor' AND e.status IN ('published_live', 'published_demo');
ALTER VIEW app.public_pick_analyst OWNER TO postgres;
REVOKE ALL ON app.public_pick_analyst FROM PUBLIC;
GRANT SELECT ON app.public_pick_analyst TO suhail_public, suhail_app;
