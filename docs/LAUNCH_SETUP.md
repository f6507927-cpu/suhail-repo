# Workspace launch preparation

Connection/release instructions: [DEPLOY.md](DEPLOY.md), D-139. Both restricted
runtime URLs use Session 5432 with unchanged identity/TLS controls. This
workspace command uses `suhail_app` and consumes its per-user/database headroom;
run it serially, not during an unbounded old/new Autoscale overlap.

This change is preparation only (D-132–D-134). No external database was read,
written, migrated or seeded for verification. No publication, production
enablement, editorial default, deployment or SITE_MODE change is authorized.

## Founder-run sequence (not executed against Supabase)

1. Review the new **unapplied** `drizzle/0010_launch_setup.sql` and its generated
   snapshot. It adds the explicit cover-page shares concern and a three-column
   daily unmet-query aggregate, RLS, private application reads and a narrowly
   scoped public increment function. Apply migrations separately using the
   project's established migration process when authorized.
2. Fill **all 75 required closes** in `data/launch/inputs.csv`. All supplied
   activity/category-basis/price-source fields are preserved. The untouched
   file must fail, including in dry-run, before a database connection.
   July 31, August 31 and September 30, 2026 are weekdays; each entered amount
   attests that date's last-trading-day close. This CLI does not infer holiday
   trading dates or move a weekend calendar end onto a fabricated trading day.
   Optional prohibited-income blanks retain the SEC estimate/unknown; a supplied
   gross annual amount requires its source label and note and must belong to the
   same current annual revenue period.
3. Review `data/methodologies/al-rajhi-adapted-1.0.json`, especially the provisional
   nine-category primary-activity interpretation and the synthetic candidate
   cases. Case logical keys resolve to persisted criterion IDs. Verification
   fields deliberately remain null. Founder-authorized setup now creates or reuses
   the genuine Verified Al Rajhi public methodology document and associates it
   with the draft through `associateSource`; it does not invent human verification
   metadata.
   Already-recorded verifier/date metadata is preserved on repeat runs.
   Draft preparation does not record a passing report or advance any workflow.
   Existing conflicting/finalized content is refused rather than overwritten.
4. Sign in normally and obtain an existing admin account through the established
   process. The CLI never creates a user, grants a role or changes MFA.
5. If either example methodology is the editorial default, setup stops before
   changes. Select an eligible default separately under the existing gates;
   setup never reassigns it.
6. In the workspace, after separately authorizing any actual SEC imports:

   ```sh
   pnpm setup:launch -- --actor <existing-admin-email> --dry-run
   pnpm setup:launch -- --actor <existing-admin-email>
   ```

The first command is read-only: input validation, actor/default/content checks,
candidate coverage evaluation, planned definitions and per-ticker contingent
operations. It makes no network SEC calls, status updates, audit events,
checkpoints or generated files.

The second creates/reconciles only missing draft content and unpublishes existing
examples through the visibility service. Within the governed draft transaction,
it creates or reuses one `methodology_document` source with provider
`Al Rajhi Capital (public document)`, the committed Arabic document title and
the methodology's exact Al Rajhi PDF URL. Creation sets `retrieved_at` to now,
`confidence_tier` to `Verified`, and all demo/synthetic/production-blocked flags
to false, with an actor-attributed audit event. Existing eligible evidence is
reused without changing its retrieval timestamp; ambiguous or tainted matching
evidence is refused, not relabelled. Missing associations use `associateSource`
and its audit/gates; already-associated evidence is a no-op on repeat.
Dry-run only describes this step and writes nothing. It never advances the
workflow, approves, publishes, enables production or changes the default.
It then performs serial Nasdaq/NYSE
lookup/add/SEC ingestion and audited evidence loading for the exact 25 tickers.
Runtime failures are sanitized and do not stop later tickers. Each report includes
ingest outcome/error, closes, selected quarter/freshness note, market-value basis,
actual/requested activity category, prohibited-income state and missing inputs.
Re-running unchanged successful evidence adds no new rows or audit events.

## Calculation and privacy boundaries

- Denominator derivation is versioned `calc-2026.10.5`; SEC annual mapping and
  deterministic evaluation remain unchanged. Existing calculation and engine
  replay versions remain supported and historical snapshots are not rewritten.
- Choose the newest complete quarter among the two latest completed quarters.
  Fallback has `prices from <quarter>` provenance and estimated freshness quality
  (Medium confidence / adequate with estimates absent worse evidence). Older or
  incomplete eligible quarters are unknown. Missing equity/shares and explicit
  latest-cover-page multiple classes/members or aggregation block the basis,
  including an equity-floor shortcut. Single dei observations, historical
  duplicates, missing dimensions and sibling listings do not establish plurality.
- Valid successful zero-result public searches attempt a best-effort atomic UTC
  daily aggregate. The table has only normalized query, day and count—no request
  identifiers, event rows or sub-day times. No anonymous table read grant exists.
  Application connections have SELECT only; public connections can execute only
  the bounded increment function. This is an aggregate, not unique-user analytics
  or an exact traffic quota.
- Only admin+AAL2 can load the aggregate panel. Editors retain securities access,
  but neither query nor receive the counts. New Arabic empty-state/admin phrases
  remain marked and inventoried for human review. Exact mandatory disclaimers
  remain exempt under D-120; no other negative phrasing gains an exemption.

## Local verification

Tests use fixture SEC responses and fresh disposable plain PostgreSQL 17 only.
The actual pnpm CLI is tested both with the untouched file (75 close errors,
no connection) and populated local fixture inputs (read-only dry-run, unchanged
row/audit/file counts). Tests also exercise actor attribution, both example-default
stops, draft conflict/finalization refusal, candidate coverage, serial failure
continuation, unchanged retries, sourced correction reversals, share-class guards,
all quarter boundaries including January 1, fallback quality, atomic private
aggregates, loader authorization, and public copy from dictionaries, dependency
graphs and browser-rendered content.

Real founder-entered prices, real hosted admin/editor MFA sessions, Shariah/source
verification, legal review and approved Arabic content remain founder-run launch
gates. Local fixture checks do not establish those approvals.

Verified locally: typecheck, lint and logical-direction lint; 1,052 unit tests;
210 database tests on a fresh disposable cluster; 225 engine tests with 100%
statement/branch/function/line coverage; 11 Chromium public-route browser checks.
The English zero-result page was also visually checked. Signed-in admin/editor
UI was not verified with real MFA sessions; authorization and editor non-disclosure
are covered by isolated service/page tests. No Safari/Firefox claim is made.
