---
name: Supabase connection modes
description: Founder-required pooler routing and plain-PostgreSQL integration boundary.
---

Use Supabase's Session pooler on 5432 for both restricted app/public runtime roles as well as migrations and connection smoke tests. The founder explicitly superseded prior Transaction-pooler recommendations. Integration tests run only on disposable plain PostgreSQL 17 locally in the workspace and in the CI service container, never on a Supabase project. Keep the harness's `auth.users` stub logic unchanged.

**Why:** The founder reports postgres-js pipelining stalled through Transaction 6543, with active / ClientRead sessions up to 4,893 seconds, and reports runtime URLs now use Session 5432. This is supplied incident evidence, not independently reproduced. Lifetime/keep-alive settings are not proof of a universal cure. The user also explicitly restricted integration tests to plain PostgreSQL.

**How to apply:** Follow `docs/DECISIONS.md` and `docs/PHASE_ZERO_DATABASE.md`. Supabase compatibility is verified by applying migrations to the real project plus a connection smoke test, not by altering managed auth tables for integration tests.

Code merges must not automatically apply external database migrations or seeds.

**Why:** A Supabase integration retry applied migrations before its setup assertion failed; a failed test run does not imply that the database was untouched. Merging code is not separate authorization to mutate the database behind saved migration credentials.

**How to apply:** Keep automatic reconciliation limited to dependency and code checks. Verify the intended target and authorization separately before any external database mutation.

Do not assume transaction-pooler startup parameters become effective PostgreSQL
timeouts, even when connection and runtime-role verification succeed.

**Why:** A transaction pooler can accept a connection while ignoring requested
startup settings. Connection success and role identity do not prove effective
statement or idle-in-transaction timeouts.

**How to apply:** Gate timeout delivery on sanitized effective `SHOW` values
through both actual clients. If values differ, stop and obtain approval for
role-level defaults or explicitly limited transaction-local coverage; do not
silently ship ignored settings or mutate live roles.

Do not interpret an HTTP request ending as proof that its database transaction
or advisory lock ended.

**Why:** The founder reported an app session stuck in `active / ClientRead` for
over 80 minutes while later requests repeatedly ended near 120 seconds. Request
duration alone did not identify the timeout or establish backend cancellation.

**How to apply:** Distinguish client-pool waits, pooler waits, statement/lock
timeouts and idle transactions. Require backend/error evidence before naming
the responsible timeout; retain server-side limits independently of HTTP limits.
