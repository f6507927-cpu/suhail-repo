# Adapted Al Rajhi infrastructure — implementation handoff

## Scope and decisions

D-122–D-128 record the seven **provisional founder adaptations**, including the
two chat clarifications: use the month's last trading-day close, not necessarily
calendar month-end, and missing/unknown equity makes the basis unknown.
D-121 identifies the separate date-display work. During synchronization the
incoming edge policy was found to reuse D-121; its unchanged policy and references
were renumbered D-129 to keep decision IDs unique.

These decisions are not Shariah approval, affiliation or authorization to launch.
No methodology/criterion record was created, no editorial default or production
gate was changed, and no Supabase/external database was migrated, imported or
seeded. The reference document was not edited. No dependencies were added.

## Data and precision behavior

- New screening and candidate governance use `engine-1.0.2` /
  `calc-2026.10.4`. Decisions compare unrounded ratios; display remains two
  decimals. Null margin remains different from zero margin.
- Historical `engine-1.0.1` dispatch preserves rounded comparisons and
  ten-decimal canonical numbers. New payloads preserve full JavaScript numeric
  precision so unrounded decisions replay even below the old serialization
  precision. Historical calculation versions `.1`–`.3` remain supported.
  Unsupported engines are still refused, not replayed under new rules.
- All 13 historical EX-A/EX-B engine golden hashes and their snapshots are
  unchanged. Shared governance checks verify those hashes **and** execute the
  current engine against their unchanged expected outputs.
- `market_value_basis` is a persisted **data-layer** financial fact, scoped by
  security because share classes can have different price evidence. SEC facts
  remain shared company/annual-period facts. Screening, impact comparison,
  private facts and public stock fundamentals restrict security-scoped facts
  appropriately. Nothing was added to the SEC mapping for this derived item.
- Its internal calculation source and mapping trace retain the quarter, each
  calendar month-end, actual trading date, price/source IDs, shares fact and
  as-of date, equity fact, input quality, three market values, mean, equity
  floor, chosen value and missing-input explanations.
- `price_bar.month_end_for` is an explicit sourced analyst assertion of which
  calendar month-end a close represents. The actual close date must be within
  that month. No calendar inference, arbitrary earlier-close fallback or
  cross-month carry occurs. Corrections use descending creation time then ID;
  manual writes use an actual write timestamp for deterministic correction order.
  Correction deduplication compares only the effective latest daily/month-end
  observations, not matching historical rows. Reversals (10 → 13 → 10) and
  changed trading-date assertions append new evidence and refresh the basis;
  repeating the effective correction is still a no-op. Correction timestamps
  are monotonic at the driver's millisecond precision under the issuer lock.
- Refresh runs after manual prices, relevant sourced overrides, SEC acceptance
  and annual persistence, across the issuer's securities. Pre-screen refresh
  uses the **caller's explicit asOf**, preventing quarter-rollover reuse.
  Existing issuer locks serialize the writes. Identical price submissions,
  identical protected corrections, unchanged annual evidence and repeated
  same-date screening do not append redundant evidence/audits/runs.
- Prices guidance identifies the latest completed quarter and its three
  observations/missing inputs. New income entry is admin-only, narrowly scoped
  to absent current prohibited income, sourced, nonnegative and annual-period
  aligned. Existing protected correction/alternative/accept behavior remains.

## Migration for the founder to apply

`drizzle/0009_adorable_rick_jones.sql`, with
`drizzle/meta/0009_snapshot.json` and the updated migration journal:

- Adds nullable `financial_fact.security_id` and its foreign key.
- Keeps one current company-wide fact per key and separately one current
  security-specific fact per company/period/line/security.
- Adds nullable `price_bar.month_end_for`.
- Grants public SELECT on the new fact security ID solely so existing explicit
  public projections can filter share-class evidence; no private source notes
  or hash-payload grant is added.

Applied and tested **only in disposable loopback PostgreSQL 17**. Existing
database data is not backfilled or relabelled. Old un-attributed prices do not
silently qualify as month-end evidence. Database-backed screens need the
migration before using these new fields.

## Genuine fixture evidence and legitimate snapshot changes

Read-only retrieval used the existing SEC client and process-local request
limiter, without exposing its configured user agent or accessing a database.
`scripts/sec/inspect-interest.ts` reproduces candidate inspection.

- JPM `InvestmentIncomeInterest`: **28,032,000,000 USD**,
  **2025-01-01–2025-12-31**, annual **10-K FY2025**,
  accession **0001628280-26-008131**, filed **2026-02-13**.
- Retrieved **2026-10-16T11:08:39.082Z** from
  `https://data.sec.gov/api/xbrl/companyfacts/CIK0000019617.json`.
  Full serialized-response SHA-256:
  `ded1884952751a50387a9675bf9476df51f416b431bf489c95fda9ad6dc520fe`.
- The committed JPM fixture adds unchanged original observations for this tag,
  retaining annual, comparative and quarterly distractors. AAPL/MSFT were also
  re-read; their original response hashes and observation values are unchanged.
  Their retrieval timestamps are updated in fixture metadata.
- AAPL/MSFT have no compatible candidate and remain unknown. Combined
  interest/dividend concepts were inspected but **not enabled**.
- The mapped JPM value is **estimated / Estimated**, not reported gross
  prohibited income. Its note explicitly excludes untagged interest,
  prohibited-activity revenue and other analyst-identified income. It is not a
  complete total. Absent, negative or incompatible evidence remains unknown.
- Only the **four SEC mapping snapshots** changed: calculation version, genuine
  retrieval timestamps and the added prohibited-income fact. No engine golden
  snapshot was replaced. New-run hashes legitimately change with their new
  versions, lossless numeric serialization and new evidence.
- Browser test data and modified integration inputs are explicitly synthetic.
  Neither those values nor the real SEC test issuers authorize a launch universe
  or a methodology.

Full per-issuer mapping/provenance: `docs/SEC_ANNUAL_MAPPING.md`.

## Verification results

- `pnpm typecheck` — passed.
- `pnpm lint` — passed without warnings.
- `pnpm lint:logical` — passed.
- `pnpm test` — **977 passed**, 48 files after synchronization.
- `pnpm test:engine` — **225 passed**; **100% statements, branches,
  functions and lines**, including all 13 executable engine modules.
- `env -u DATABASE_URL_TEST pnpm test:db` — **193 passed**, 7 files,
  against a fresh disposable PostgreSQL 17 cluster, bootstrap first.
- Financial browser fixtures — **13 passed**, serial Chromium, including
  admin/editor controls, month-end attribution validation, missing-quarter
  guidance and sourced income entry with its annual-period payload.
  Invocation uses the existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE` override with
  the workspace's managed Chromium, not a changed project dependency.
- The application workflow restarted successfully. The real unauthenticated
  `/en/auth/sign-in` page returned 200 and rendered without browser errors.
  **The real signed-in admin UI was not verified**: browser interaction checks
  used the repository's isolated fixtures, not an auth bypass.

## Changed files

Engine:
`src/engine/{canonical,evaluators,validate,versions}.ts`,
`src/engine/__fixtures__/synthetic.ts`,
`src/engine/{adapted,evaluation,hash}.test.ts`.

Data, refresh, screening and governance:
`src/db/schema/market.ts`, `src/db/stock-public.ts`,
`src/ingest/sec/{annual,ingest,mapping}.ts`,
`src/lib/financial/{contracts,data,persistence,service,market-value,market-value-persistence}.ts`,
`src/lib/methodology/{reports,service}.ts`, `src/screening/{service,verify}.ts`.

UI:
`src/components/financial/FinancialAdmin.tsx`.

Fixtures, tests and retrieval/report tooling:
`tests/{financial-admin-ui,market-value,screening,sec-mapping}.test.ts`,
`tests/{financial,screening,stock}.integration.test.ts`,
`tests/browser-fixture/FinancialFixture.tsx`,
`e2e/financial-fixture.spec.ts`,
`tests/fixtures/sec/{aapl,msft,jpm}.json`,
`tests/__snapshots__/sec-mapping.test.ts.snap`,
`scripts/sec/{inspect-interest,mapping-report}.ts`.

Documentation and migration:
this handoff, `docs/{DECISIONS,SEC_ANNUAL_MAPPING,ARABIC_REVIEW,AR_REVIEW_KEYS}.md`,
`docs/{arabic-draft-proposals,arabic-drafts}.json`,
the migration/snapshot/journal listed above, and the project-memory pointer
explaining precision/replay versioning and sourced-correction idempotency. The incoming
edge policy's D-129 reference was also reconciled in
`docs/PUBLIC_SEARCH_PROTECTION.md` and its existing memory topic.

## Remaining limitations

- The founder still applies the migration and enters the future adapted
  methodology. Shariah review, source/governance approvals, production
  enablement and any default selection remain separate existing work.
- Manual last-trading-day attribution relies on the analyst's cited evidence;
  no exchange-calendar service, licensed feed or broad price-history importer
  was added.
- SEC interest income is only an incomplete estimated proxy. Analyst review of
  gross prohibited income remains essential. The existing annual-only statement
  scope and sourced cover-page shares handling are unchanged.
- New Arabic UI copy remains visibly marked pending human review. No approved
  Arabic methodology wording was invented.
- Real Supabase AAL2 write flows and native Safari/Firefox date-input behavior
  were not exercised here; no external write permission is implied.
