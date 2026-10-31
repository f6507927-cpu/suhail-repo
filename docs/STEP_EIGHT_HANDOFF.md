# Step 8 — database-backed screening

## Scope

Implemented D-23/D-42/D-43 and the founder's additions, recorded as D-119.
No Supabase migration, seed, import, setting change or deployment was run.
**No new SQL migration is needed.** Existing pending Step-7 migration 0008 remains
the founder's responsibility before using the financial administration workflow.
The existing database `input_state` enum already supports `missing`.

## Service and stored evidence

- `src/screening/service.ts`: `screenSecurity(securityId, methodologyVersionId,
  {asOf, trigger})` reads through the app-role transaction boundary. It loads the
  issuer's latest period, current facts (including shares/market cap when present),
  period segments and the selected version/criteria.
- Input calculation version comes from **SEC_CALCULATION_VERSION,
  calc-2026.10.3**. The historical engine default, calculation rules and golden
  hashes were not changed.
- Absent facts remain absent; the engine supplies `missing`. No assets, segments,
  sources or numeric inputs are invented. No period is an explicit refusal.
  Missing required criterion date metadata also fails explicitly.
- The service takes no wall-clock date. Manual actions and jobs supply the UTC
  evaluation date. The run's database receipt timestamp is separate;
  `data_as_of` is the financial period end. The evaluation date is retained in
  `hash_payload.as_of` and the audit.
- Under the issuer lock, compare the computed hash with the latest stored run for
  that security/version. Identical input **including asOf** returns
  `{unchanged:true, runId}` without inserting a run, children or run audit.
- Otherwise insert the run, every criterion/unknown and its audit atomically.
  Preserve denormalized exchange/ticker/company/methodology/version/period labels,
  complete structured reasons, canonical payload, versions and snapshot ID.
  All screening history remains append-only.

## Verification

`src/screening/verify.ts`: `verifyRun(runId)` computes the SHA-256 of the canonical
stored payload and replays its embedded inputs only for the current engine version. It reports
`valid`, `hashMatches`, `replaySupported`, `replayMatches`, `engineVersion`, both hashes and path-level differences.
It does not read current facts, segments or methodology content.

Non-evaluated metadata omitted by the existing hash projection receives neutral
replay-only placeholders; these are not new evidence. Malformed current-engine
inputs return a replay difference rather than claiming verification succeeded.
For another stored engine version, replay is not attempted: `replayMatches` is
null and `valid` reflects the immutable hash check only. Admin feedback says
“Hash verified.” and “replay not supported for engine X” with the stored version,
never “Replay matches” = Yes/No for an unavailable replay. A hash mismatch still
fails verification. The new Arabic-facing phrases remain marked and pending review.

## Live gate and selected versions

Outside local integration tests, `Screen all` and `pnpm job:screen` check for a
non-demo/non-example-origin production-enabled version **before any job/run/audit
write**. If absent they return exactly:

> No production methodology to screen with

Once one exists, targets are the non-example editorial default and every
non-example production-enabled version, deduplicated. Preview/live site mode
does not bypass this guard. Manual live screening also refuses demo/example
versions. Local integration tests may use examples; test connections are guarded
to disposable loopback PostgreSQL.

## Jobs and commands

- `src/jobs/screen-universe.ts`: snapshot target security/version pairs, configured
  batches, persisted cursor/counts/errors/timing and unchanged-result log.
  Resume preserves the original job-start UTC date, even across midnight.
  An interrupted checkpoint can safely retry an already stored result.
- `screenUniverse` and `ingestUniverse` drain the same resumable batches inside
  the manual request. Phase-0 scope remains small; no scheduler, distributed
  coordination or extra background guarantee is added.
- `pnpm job:screen [job-run-id]` and `pnpm job:ingest [job-run-id]` build the jobs
  and run the same services from the shell. Omit the ID for a new job.
  `--help` works without database/SEC credentials.
- Existing single-batch `dist/jobs/ingest-sec.js` remains compatible.
  New bundles are `dist/jobs/screen-universe.js` and `dist/jobs/ingest-all.js`.
  Operate ingestion one process at a time.

## Admin

- `ScreeningControls.tsx` and existing securities page: version picker,
  “Run screening now”, date/version/status/short-hash history and unchanged
  markers from job logs.
- `/admin/runs/[id]` (and English equivalent): private criteria, unknowns,
  localized deterministic structured reasons, canonical payload and Verify/diffs.
- Ingestion page: admin-only “Ingest all” and “Screen all”, progress summaries
  and job history/resume.
- `screening-actions.ts`: each action starts with `requireRole`; all writes use
  `withAdminAction`. Editors can inspect/verify, but cannot screen or run jobs.
  No runtime authentication bypass or public list-all endpoint was added.

## Verification

| Check | Result |
| --- | --- |
| Typecheck, ESLint, logical CSS lint | Passed |
| Unit tests | 786 passed |
| Engine tests | 215 passed, 100% coverage |
| Disposable PostgreSQL integration | 177 passed |
| Account/methodology/navigation/financial/screening browser fixtures | 107 passed, managed Chromium |
| Main browser suite | 13 passed |
| Production build with all database variables removed | Passed |
| Jobs bundle and both workspace script help commands, no DB/SEC credentials | Passed |

Real PostgreSQL cases cover duplicate suppression, changed-fact history with
unchanged prior rows, replay after later evidence/rule changes, no-segment review,
missing-assets insufficiency with stored `missing`, explicit missing-period
refusal, tampered payloads (trigger disabled **only inside the isolated test**),
the live no-write gate and a simulated lost checkpoint across UTC midnight.
Tests use example fixtures only in the local test environment, never Supabase.

## Arabic and remaining live verification

New copy is not approved Arabic. The regenerated inventory has **218 pending
rows**, including the same two O-7 legal holds; zero unresolved caller surfaces
and unused keys. Approved D-101/D-107 wording/evidence is unchanged.

Private signed-in flows were exercised in isolated browser fixtures, not a real
live Google/TOTP session. The founder should apply pending migrations separately;
live bulk screening remains intentionally blocked until a real methodology is
production-enabled. No seed or example security should be added as a launch step.
