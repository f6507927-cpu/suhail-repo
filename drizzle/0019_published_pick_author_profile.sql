-- D-29/D-151: the draft creator is not necessarily the research's author.
-- Resolve the immutable author-email snapshot internally, without exposing it.
-- Ambiguous/missing historical identities fail closed; never guess a profile.
CREATE OR REPLACE VIEW app.public_pick_analyst WITH (security_barrier = true) AS
  SELECT p.id AS pick_id, a.id AS analyst_id
  FROM app.pick p
  JOIN app.edition e ON e.id = p.edition_id
  JOIN app.users u ON lower(u.email) = lower(p.editor_author_email)
  JOIN app.analyst_profile a ON a.user_id = u.id AND a.active
  WHERE p.pick_type = 'editor'
    AND e.status IN ('published_live', 'published_demo')
    AND (SELECT count(*) FROM app.users candidate
         WHERE lower(candidate.email) = lower(p.editor_author_email)) = 1;
ALTER VIEW app.public_pick_analyst OWNER TO postgres;
REVOKE ALL ON app.public_pick_analyst FROM PUBLIC;
GRANT SELECT ON app.public_pick_analyst TO suhail_public, suhail_app;
