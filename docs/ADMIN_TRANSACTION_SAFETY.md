# Admin transaction safety (D-135)

## Lock and connection boundaries

Ordinary `withAdminAction` and `withUserAction` mutations take shared transaction
advisory lock 73501947. They still recheck the database user/role inside the
transaction. Only `changeRole` opts into the exclusive form; `admin:grant`
already takes that exclusive lock. This protects against concurrent demotion
and preserves last-admin serialization without serializing unrelated actions.
User account writes retain their per-user row lock.

Methodology mutations retain their separate exclusive governance lock 66420020:
visibility, editorial-default and production prerequisites must be read and
written serially. Financial and screening mutations retain their existing
entity-specific row/advisory locks. They do not need the global exclusive
role-change lock.

## Callback audit

- Auth wrappers: moved dynamic imports of errors/policy code to module scope.
  Supabase verification already happens before opening a transaction.
- Registration and consent acceptance: database writes and audits only;
  Supabase sign-out and request/form parsing are outside their transactions.
- Account mutations: profile update/deletion use only transaction queries;
  sign-out happens after commit.
- Methodology, financial and screening mutation callbacks: database operations,
  pure validation/calculation and database audit helpers only.
- SEC job mutation: download, limiter/backoff and mapping happen before the
  mutation callback; callbacks persist the downloaded evidence or record errors.
- Launch preflight, draft preparation and per-item mutations: database/pure
  work only. SEC calls and output/report IO happen outside transactions.
- CLI role grants: SQL only, retaining the exclusive role lock.

No admin GET page/layout takes this lock or opens a write transaction.
Admin read helpers (`admin-data`, financial/methodology readers and stored-run
verification) authorize first, then issue ordinary reads. No GET conversion was
necessary. A regression check protects the rendering boundary.

The transaction safety test follows local helper calls from transaction and
mutation callbacks and refuses Supabase calls, fetch, SEC client calls, file IO,
timers and dynamic imports. It is a static regression guard, not a proof against
arbitrary runtime indirection.

## Migration and longer jobs

Migration 0011 sets `suhail_app`: statement 30s, lock 5s, idle-in-transaction 30s;
`suhail_public`: statement 10s. It is NOT applied to Supabase by this change.
Role defaults apply to new backend sessions; existing pooler backends must be
reconnected/recycled by the operator. After applying, check effective SHOW
values through both real runtime roles; do not infer enforcement from a
successful migration alone.

A job that genuinely needs a longer database statement must opt in inside its
own transaction, for example `SET LOCAL statement_timeout = '2min'` before its
SQL. Do not relax the global lock timeout or hold a transaction during network
IO, timers or file work. No current job is given a speculative longer timeout.

Lock timeout SQLSTATE 55P03 rolls back and reaches the existing sanitized action
failure/reload response; it is not retried into another queue.

## What the incident establishes (and does not)

The former exclusive lock allowed one stuck transaction to block every later
role-checked mutation. Three occupied app connections can also starve ordinary
GET reads waiting for that same client pool.

`active / ClientRead` means the backend was waiting to receive data from its
client, not spending that entire duration executing the users SELECT. This can
include an extended-query protocol exchange; the displayed SELECT is not proof
that its query plan took 4,893 seconds. No network calls were found inside the
audited production callbacks. Dynamic imports were found and removed, but the
snapshot does not prove they caused the original stall.

There is no 120-second request/query timeout in the application runtime.
postgres-js has a 10-second connect timeout and 20-second *idle connection*
timeout; neither is a running-query deadline. Playwright's 120-second settings
are test-only. The prior hosted timeout probe showed effective database
statement/idle-in-transaction settings were zero. Supavisor's transaction
pool `query_wait_timeout` is a candidate for repeated 120-second waits; the
request durations alone cannot establish which infrastructure timeout fired.
Confirm with the corresponding pooler/server error (for example
`query_wait_timeout`), SQLSTATE and configured pooler setting. Do not label it
a PostgreSQL statement timeout without that evidence. Nothing in this change
queries or reconfigures the live pooler.

## Verification

- Typecheck, ESLint, logical CSS lint and diff whitespace checks passed.
- All 16 new unit checks (transaction guard and safe lock-timeout errors) passed.
- All eight new disposable PostgreSQL tests passed. Idle termination uses a
  transaction-local 250ms timeout for a fast regression, separately asserting
  the migrated role default is 30s. Lock-wait tests use the actual 5s role default.
- Final targeted PostgreSQL run: 43 passed (new lock suite plus existing accounts
  suite, including concurrent last-admin demotions).
- Full database run: 218 passed on fresh disposable PostgreSQL 17.
- Full unit run: 1,068 passed. Launch tests now use dedicated blank and
  synthetic-filled CSV fixtures, including isolated CLI working directories.
  The committed launch input CSV is unchanged.

No hosted migration, live database inspection, seed or pooler setting change
was performed. No signed-in browser verification is claimed.
