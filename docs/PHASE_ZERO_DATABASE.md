# Phase Zero database mapping and operations

This is the Step 2 implementation/handoff, not a replacement for the founder's reference.
Decisions D-02, D-09–D-18, D-25, D-28–D-36, D-42–D-44,
D-50, D-52–D-53, D-55 and D-72–D-77 take precedence over §6.

## Field mapping

- All 25 requested entities use `app`, UUID primary keys, timestamptz
  `created_at`/`updated_at`, nullable `created_by`, and `is_demo NOT NULL DEFAULT false`.
  `users.id` is provided by Supabase; no auth-schema FK/default UUID.
- Reference `created_date`/`updated_date` map to `created_at`/`updated_at`.
  Money/quantities are numeric(30,6); ratios/thresholds/margins are
  numeric(12,6), mapped to JS numbers. Dates without time are SQL dates.
- Reference string IDs become UUID FKs except historical user IDs (D-76),
  historical UUID arrays (D-73), generic audit entity IDs (text), and
  `screening_run.financial_snapshot_id` (the §7.4 synthetic text identifier).
  Edition's human-facing `edition_id` is text; children and supersession
  reference edition's UUID `id`, not that text.
- `source_ids` on versions supplies provenance for D-74 public methodology
  documents without assigning document ownership. Source/pick UUID arrays
  have no FKs; validated application insert helpers cover every such array
  and editor evidence source IDs. RLS array predicates have GIN indexes.
- Text key arrays (`required_inputs`, numerator/denominator line items,
  tokens, validation details, risks) remain text arrays. Criterion-result
  `input_states` uses the full enum, including §6's `missing`.
- Every reference enum retains its exact vocabulary, including audit types
  naming deferred Phase 1 operations; no scoring table/column is introduced.
- All reference fields on retained entities are mapped unless superseded by
  D-35 (user fields), D-42 (structured reasons), D-55 (scoring omissions),
  D-75 (bilingual editor fields). Editorial defaults for absent Phase 1
  score/benchmark tables are omitted rather than dangling IDs.
- Analyst profile follows D-29. Job name/status/cursor/counts/errors/timings
  follow D-28; status stays text and cursor/errors are structured metadata.
  This step does not choose a future job execution vocabulary.
- Historical labels on runs/results/editions/picks/revisions are retained.
  Reports are append-only, version-linked impact/test JSON payloads.
  Approval FK points to `audit_event` and must be `approval_recorded` (D-72).
- Editor checks require Arabic thesis, why-now, valuation context,
  conflict disclosure and `risks_ar` for editor picks; English stays optional.
  Evidence shape is `{claim_ar, claim_en?, source_id, value}`.
- Non-permissible revenue uses `business_segments` as its input, not an
  invented financial-fact key. Both lease liabilities and shares outstanding
  are allowed fact keys under D-44, but fixtures never alter debt numerators.
  Purification inputs are methodology-specific metadata, not added fact keys.

## Access matrix

`suhail_app` has RLS read/insert everywhere; update/delete only on mutable tables.
An application's auth layer must still authorize individual requests (not built here).

| Tables | Anonymous rows (`suhail_public`, explicit public columns only) | App mutations |
| --- | --- | --- |
| exchange | All | CRUD |
| security | Listed AND in universe | CRUD |
| company, financial_period, financial_fact, business_segment | Company has listed in-universe security | CRUD |
| price_bar | Listed in-universe security | CRUD |
| source | Referenced by readable fact, period, segment, criterion result, pick (including evidence), or public methodology version | CRUD |
| methodology | Has public version | CRUD |
| methodology_version | `is_public` | Draft content CRUD; non-draft workflow metadata only |
| methodology_criterion | Public parent version | Draft parent only |
| screening_run | Public security AND public version | Insert only |
| screening_criterion_result, screening_unknown, explanation_object | Readable parent run | Insert only |
| edition | published_demo / published_live | CRUD |
| pick | Published parent edition | CRUD |
| edition_revision | Published parent edition | Insert only |
| analyst_profile | Active | CRUD |
| audit_event, editorial_approval, methodology_version_report | None | Insert only |
| users, editorial_setting, job_run | None | CRUD |

`app.public_settings` is an owner-executed `security_barrier` view exposing
only the editorial row's default methodology-version ID; direct setting access is denied.
Public roles cannot write, read any email/notes/internal creator IDs, or execute
account deletion. Selecting `*` deliberately fails on column-granted tables:
public queries must explicitly select approved columns.

### Source public column allowlist (D-74)

`id`, `created_at`, `updated_at`, `is_demo`, `label`, `source_type`, `provider`,
`document_title`, `document_reference`, `source_url`, `retrieved_at`,
`reporting_period`, `confidence_tier`, `is_synthetic`.
`notes` and `created_by` are excluded. Other public allowlists are explicitly
committed in the security migration; no current/future email column gets SELECT.
Internal workflows/history/report links, notes, audit details and hash payload
are not public. No generic public list endpoint is supplied.

## Migrations and commands

1. `drizzle/0000_fat_human_torch.sql`: generated schema, 25 tables, enums,
   FKs, checks, unique/partial/GIN indexes.
2. `drizzle/0001_security.sql`: idempotent roles, grants/default privileges,
   RLS policies and one-column settings view.
3. `drizzle/0002_integrity.sql`: idempotent immutability/timestamps,
   approval/report checks, audit privacy, historical UUID comments, deletion.
4. `drizzle/0003_evidence_shape.sql`: idempotent editor-evidence shape guard.
5. `drizzle/0004_account_security.sql`: account/session authorization policies and guards.
6. `drizzle/0005_pre_step_six_hardening.sql`: permanent demo-provenance latch,
   production prerequisite gate, segment-share check and history TRUNCATE refusal
   (D-92–D-94). Review the separate
   [security handoff](PRE_STEP_SIX_SECURITY_HANDOFF.md) before rollout.

Never edit an applied migration. `pnpm db:generate` does not need a database.
`pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio` use only
`DATABASE_URL_MIGRATIONS` (owner `postgres`); runtime clients lazily validate
only their own `DATABASE_URL_PUBLIC` / `DATABASE_URL_APP`.
Both runtime clients are server-only, verified TLS, prepare:false, max:3,
max_lifetime:1800 seconds and TCP keep_alive:30 seconds (D-139).
Every non-test connection requires the explicit public PEM CA bundle in
`SUPABASE_DB_CA_CERT` (D-94), with certificate-chain and hostname verification.
Only disposable loopback test connections can omit TLS. Credentials and the CA
are read lazily on connection; imports/builds/schema generation do not require them.

### Supabase connection modes from Replit

Supabase direct connections are IPv6-only by default (unless the project's
IPv4 add-on is enabled). For this Replit setup, use the IPv4-capable **shared
Session pooler** on 5432 for migrations, connection smoke tests and both
restricted runtime roles (D-139 supersedes earlier Transaction recommendations):

| Credential | Pooler mode | Port | Database role |
| --- | --- | --- | --- |
| `DATABASE_URL_MIGRATIONS` | Session | 5432 | `postgres` |
| `DATABASE_URL_PUBLIC` | Session | 5432 | `suhail_public` |
| `DATABASE_URL_APP` | Session | 5432 | `suhail_app` |

Copy the exact host and connection string from Supabase's **Connect** dialog;
do not construct the pooler hostname from the region. Shared-pooler usernames
include the project reference (`postgres.<PROJECT_REF>` or
`<ROLE>.<PROJECT_REF>`). Keep passwords only in secrets, not documentation.
Verified TLS with `SUPABASE_DB_CA_CERT` and runtime `prepare: false` remain
required. Do not rely on pooled session state. The founder reports Transaction
6543 pipelining stalls (active / ClientRead up to 4,893 seconds), and reports
runtime URLs now use Session 5432; this was not reproduced here. Lifetime and
keep-alive are not a universal stall cure. No hosted URL, pooler configuration,
role default or schema was changed by this preparation. See [DEPLOY.md](DEPLOY.md)
for separate per-role 15-slot budgets, the overall 200-client limit, and bounded
old/new release overlap. Those hosted limits are founder-supplied, not verified.

**D-78 supersedes the earlier Supabase-hosted integration-test guidance:**
`DATABASE_URL_TEST` is only for disposable plain PostgreSQL 17 in the workspace
or the CI service container. It must never point to Supabase. Supabase
compatibility is verified separately by applying migrations to the intended
real project and a connection smoke test, with approval before any production
migration. Integration tests retain the existing `auth.users` stub logic.

Source: [Supabase connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres).

Dependencies: `drizzle-orm` supplies typed PostgreSQL schema/queries/migration
runner; `postgres` is the requested postgres-js driver; development-only
`drizzle-kit` generates committed migrations and runs Studio; development-only
`tsx` runs TypeScript CLI scripts without bundling or importing Next server modules.
Native **PostgreSQL 17** is a development-only system dependency: the committed
`.replit` Nix package `postgresql_17` supplies local server/client binaries.
It is not Replit Database, an app runtime dependency, or a Docker container.

### Reproducible workspace integration database (D-78)

In one terminal:

```sh
pnpm db:test:up
```

The foreground launcher checks for PostgreSQL 17, refuses an occupied port,
initializes a fresh cluster under ignored `.cache/postgres-test-*`, and starts
a local process bound only to **127.0.0.1:55432**. It creates database
**suhail_test** owned by **postgres**, with loopback-only trust authentication
and no password. It never uses saved database credentials or touches another
cluster. The data/logs are excluded from Git, deployment and the Docker build.
On a non-Replit workstation, install native PostgreSQL 17; if its binaries are
not on PATH, set `POSTGRES_TEST_BIN` to that installation's bin directory.

In another terminal, when `DATABASE_URL_TEST` is unset:

```sh
pnpm test:db
```

Wait until the launcher prints **Disposable PostgreSQL 17 ready** before
starting tests.

The default is `postgresql://postgres@127.0.0.1:55432/suhail_test`.
If a saved `DATABASE_URL_TEST` still points elsewhere, clear it only for this
invocation without changing stored credentials:

```sh
env -u DATABASE_URL_TEST pnpm test:db
```

An explicit loopback URL is honored (CI uses port 5432). Non-loopback test URLs,
including Supabase direct and pooler hosts, are rejected **before connecting**.
An invalid/empty supplied URL fails explicitly rather than silently falling back.
The test suite still requires PostgreSQL 17 and an empty `app` schema.

Stop the launcher with **Ctrl-C**: it shuts down its own server and removes only
its own temporary cluster. Stop and restart before each full suite rerun, since
suite setup commits migrations/fixtures. The launcher stays in the foreground;
it does not configure a preview workflow or replace the application workflow.

### CI integration database

`.github/workflows/ci.yml` already provisions a **`postgres:17` service
container**, with database/user `suhail_test`/`postgres` and isolated CI trust
authentication. It exports
`DATABASE_URL_TEST=postgresql://postgres@127.0.0.1:5432/suhail_test` and runs
`pnpm test:db`. The suite itself applies migrations and seeds twice; CI does not
need the workspace launcher, a Supabase project or Supabase credentials.

### Manual role activation, later (do not run as part of this task)

Run as `postgres` on the intended database; substitute passwords securely:

```sql
ALTER ROLE suhail_public WITH LOGIN PASSWORD '<PUBLIC_ROLE_PASSWORD>';
ALTER ROLE suhail_app WITH LOGIN PASSWORD '<APP_ROLE_PASSWORD>';
```

Roles initially have NOLOGIN, no superuser/bypass-RLS/create privileges, no
passwords, and no PUBLIC schema grants. Use role-specific connection strings.
Never grant either role to an anonymous Supabase/PostgREST role.
Existing role memberships are an operator responsibility on an existing installation.

## Account deletion and immutable records

The postgres-owned function has empty search_path, qualified references, an
auth-table existence guard, and application-only EXECUTE. No auth stub is in
migrations. The server must verify the session ID before invoking it.
Admins must first be demoted. Mutable user FKs become NULL; immutable user
UUIDs stay identical. A new deletion event stores only the UUID.
End-user registration/consent/deletion events require `entity_name='users'`,
UUID `entity_id`, fixed summary equal to event type, no details/email/role;
actor/creator IDs, if supplied, must equal that user ID.
Non-draft versions cannot be returned to draft to bypass content protection.
Allowed metadata: workflow_status/history, production_enabled, production_blocked,
impact_report_id/test_report_id/approval_id, approved_by/approved_at,
is_public, updated_at. Criteria lock their parent while checking draft state.
The provenance latch cannot be cleared, and production flags/prerequisites are
subject to D-93's cross-table gate. All eight append-only tables reject TRUNCATE.

## Verification and open scope

`DATABASE_URL_TEST`, when supplied, must point to a loopback disposable plain
PostgreSQL 17 database owned by
postgres. The integration suite refuses a nonempty app schema, never touches
production/migrations credentials, requires `auth.users` to be absent,
migrates before checking for and creating its auth stub,
seeds twice, commits isolated suite fixtures, and rolls back each role-test
mutation. Repeated suite runs require a fresh disposable database. CI supplies
a PostgreSQL 17 service. Teardown only closes the connection; it does not drop
roles, schemas, migrations or committed fixtures.
Actual check results are recorded in the final handoff.

### Executed verification

- `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`: passed.
- `pnpm test`: latest run passed 72 tests across 6 files, including local-default,
  non-loopback rejection, native version/port guards and CI service checks.
- `pnpm test:db`: 84 tests passed on a separate local PostgreSQL 17.6
  cluster, covering migration/seed idempotency, every table's grants/RLS,
  provenance, each email exclusion, immutability, constraints, reference
  insertion, account deletion and byte-for-byte-equivalent historical rows.
- `pnpm build`: passed with no database runtime credentials required.
- `pnpm db:generate`: reports 25 tables and no uncommitted schema changes.
- `pnpm db:migrate`: applied all four migrations to a second disposable
  database through the actual CLI.
- `pnpm db:seed`: actual CLI executed twice; criterion count remained ten.
- `pnpm db:studio`: started with the postgres driver, and its initialization
  API returned the PostgreSQL dialect and schema files.
- Existing preview restarted successfully and returned HTTP 200; no UI was changed.

During the initial local verification, no connected/production database,
role password, integration or deployment was changed. The scoped ESM manifests in the database source and CLI folders
let tsx execute the scripts without converting the rest of the Next project.
Vitest reports its existing native-loader advisory; it does not fail checks.

### Reproducible-launcher verification

Started the database through `pnpm db:test:up` and waited for readiness, then
ran `env -u DATABASE_URL_TEST pnpm test:db`. No URL was supplied: this exercised
the new default at **127.0.0.1:55432**, database **suhail_test**, on native
**PostgreSQL 17.5**. **All 84 integration tests passed.** Typecheck, lint,
logical lint, 72 unit tests and the production build also passed.

The unchanged CI configuration was confirmed to use `postgres:17` and its
loopback service URL. A separate launcher lifecycle check confirmed SIGINT
shutdown exits successfully and removes its own cluster. Forced termination
(for example SIGKILL) can leave ignored cache files; subsequent starts still
use a fresh directory, never reset a pre-existing cluster. No Supabase project
was used in this verification and no migration or auth-stub logic was changed.

### Subsequent Supabase Session-pooler retry

`pnpm test:db` was retried using the saved `DATABASE_URL_TEST`, without a local
override. The Session pooler connected successfully and PostgreSQL 17 checks
passed. Setup applied migrations, then failed at the assertion that
`to_regclass('auth.users')` must be NULL: Supabase already supplies its managed
`auth.users` table.

Result: **1 failed suite; all 84 tests skipped**. Seeding, suite fixture
creation and role-test mutations did not run. Migrations were applied before
the assertion failed, and teardown did not undo them. No auth table was
dropped or altered.

Even a fresh Supabase project has managed auth tables. Following this failed
retry, D-78 explicitly prohibits integration tests on Supabase projects and
keeps the auth stub unchanged. Use the disposable workspace process or CI
PostgreSQL 17 service instead. Do not remove managed auth tables or rerun the
suite against the now-populated Supabase `app` schema.

No unresolved Phase 0 §6 mapping is blocking this step. The future job status
vocabulary, auth/session flows, workflows, engine, ingestion, launch universe,
verified production methodology, Arabic legal text/review and launch gates
remain outside this step. They must be supplied/decided before those steps.
