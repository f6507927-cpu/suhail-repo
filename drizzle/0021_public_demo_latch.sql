-- Public demo hiding: let anonymous reads exclude records carrying the
-- permanent D-93 production_blocked latch directly, instead of re-deriving it
-- from relabelable columns. Read-only column grants; no data is changed.
GRANT SELECT (production_blocked) ON app.methodology TO suhail_public;
--> statement-breakpoint
GRANT SELECT (production_blocked) ON app.methodology_version TO suhail_public;
--> statement-breakpoint
GRANT SELECT (production_blocked) ON app.source TO suhail_public;
