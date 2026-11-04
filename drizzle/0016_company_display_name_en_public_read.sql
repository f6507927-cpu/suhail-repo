-- D-16 / D-148: column-level public grants do not expand on ADD COLUMN.
-- Curated display names are already part of the approved public projection.
GRANT SELECT (display_name_en) ON app.company TO suhail_public;
