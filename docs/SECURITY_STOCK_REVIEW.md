# Security and stock review corrections

## Local scope and baseline

The review's supplied revision `f679985` is unavailable in this checkout.
Implementation uses the current source, not a verified comparison to that revision.
No live SQL, Supabase inspection/settings, Cloudflare changes, deployment, hosted
schedule or account changes are authorized or performed.
The cancelled ten-second timeout audit is not resumed.

## Preview, rate limits and diagnostics

- Only approved `/_next/static/` paths retain Next's original public immutable
  caching. Preview documents/RSC, other assets, errors and 429s remain no-store;
  noindex and security headers remain. Basic Auth remains removed under D-137.
- The header Sign in link has `prefetch={false}`. Presence of
  `next-router-prefetch` excludes only auth/search token consumption. It is not
  authentication and does not exempt APIs or bypass any route guards.
  Unmarked traffic retains D-136's capacities, locale/alias sharing and last-hop
  identity. This remains local per-process abuse reduction, not a global quota.
  Next 16's default proxy adapter strips Flight headers before application code.
  `skipProxyUrlNormalize: true` preserves the prefetch header; URL/alias identity
  normalization remains in the existing limiter and route guards remain intact.
- Temporary diagnostics are OFF by default. The founder may temporarily set
  `FORWARDED_DIAGNOSTICS=1` in the workspace/server environment and restart.
  In Replit's **Start application** server output, find the JSON event
  `forwarding_diagnostic`. It contains exactly `event`, `entry_count` and
  `last_entry`. No raw header, IP, chain, request, query, cookie, user or token
  is logged. Disable by removing the variable or setting `0`, then restart.
  For code removal, remove the proxy call, diagnostic module, environment entry
  and its dedicated tests; do not change the client-identity algorithm.
- Count is comma-delimited entry count (missing=0, empty header=1).
  Classification is `missing`, `invalid`, `private`, `known_proxy_range` or
  `public_unknown`. Private ranges are IPv4 loopback, RFC1918 and link-local;
  IPv6 `::1`, `fc00::/7`, `fe80::/10`, including IPv4-mapped forms.
  The finite known-proxy subset is **only** Cloudflare's
  `173.245.48.0/20` and `2400:cb00::/32`, including mapped IPv4.
  This label means range membership, not proof of actual proxy ownership,
  authentication or forwarding trust. Other public hops stay `public_unknown`,
  even if they could be a proxy. This is not a complete Cloudflare inventory.
  Local fixtures cannot establish Replit's actual forwarded-chain behavior.
  No hosted diagnostic setting is changed by this task.

## Stock display and canonicalization

Failing ratios increase precision from two through six places if rounding
conceals their difference from the threshold or their nonzero value. If six
places still conceal it, an accurate `>`/`<` bound is shown in the numeric LTR
isolate (localized number formatting). No seventh decimal is invented.
Boolean results remain semantic result labels; finite nonzero numeric failing
evidence is additionally shown when present. Cards and table share this formatter.
Missing evidence definitions are omitted instead of claiming a present value
was not recorded; absent values retain an em dash.

Result is the second criteria-table column. Below 1800px, all criterion fields
are in cards, including calculation details and source links, avoiding hidden
columns at 1366px and mobile. Analyst coverage uses a semantic list with one
isolated item per line and no middle-dot separators.
No new Arabic translations are approved by these corrections. The Arabic
inventory is regenerated solely to reflect moved callers/line numbers.

Only an explicit root `engine_version=engine-1.0.1` uses historical ten-decimal
canonical rounding. All other versions, unversioned objects, arrays and scalars
preserve numeric values. Root dispatch applies recursively; a nested version
field does not change the root policy. Historical replay and golden hashes stay
unchanged; no engine/calculation version or supported screening list is bumped.

## Unmet-search retention: founder-operated recurring job

Unapplied migration: `drizzle/0012_unmet_search_retention.sql`.
It creates `app.cleanup_unmet_search()` owned by postgres with no EXECUTE for
PUBLIC, suhail_app or suhail_public. It is SECURITY INVOKER and gives those roles
no new table privileges. The operator/migrations identity can invoke it.

After founder review and application through the normal migration process,
run the following **daily**, using the migrations/operator identity:

```sql
SELECT app.cleanup_unmet_search(); -- returns number of deleted aggregate rows
```

Configure the recurring invocation in the operator's existing scheduler; this
repository does not install a Supabase/hosted schedule. A one-time invocation
does not provide ongoing retention. Alert/inspect job failures rather than
assuming cleanup occurred. Admin GET rendering never writes or cleans up.
Only `calendar_day < UTC-today - 90` is deleted, retaining the exact 90-day
boundary and all recent query/day counts. Cleanup is idempotent.

Operator read-only verification:
```sql
SELECT count(*) FROM app.unmet_search
WHERE calendar_day < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 90;
SELECT pg_get_userbyid(proowner), proacl
FROM pg_proc WHERE oid='app.cleanup_unmet_search()'::regprocedure;
```

Neither the migration nor any cleanup is run against Supabase in this task.

## Optional whole-transaction timeout

Standalone SQL: `scripts/db/optional/transaction-timeout.sql`.
It is intentionally outside Drizzle and its journal: `pnpm db:migrate` does not
apply it. The founder must first inspect Supabase, not assume its major version:

```sql
SHOW server_version;
SHOW server_version_num;
```

After separate review, the founder may run the optional SQL as the migrations
identity. It dynamically sets only `suhail_app transaction_timeout='60s'` when
`server_version_num >= 170000`, and emits an explicit applied NOTICE.
Below 17 it emits `Skipped: transaction_timeout is not supported below PostgreSQL 17`
without referencing the unavailable parameter in an executed statement.
This is not the cancelled ten-second statement/idle migration.

Role defaults apply to **new backend sessions**, not already-pooled connections.
Operator-controlled backend/pooler recycling and subsequent effective-setting
verification with a real new suhail_app session are needed:

```sql
SELECT current_user;
SHOW transaction_timeout; -- PostgreSQL may display 1min rather than 60s
SELECT setting FROM pg_settings WHERE name='transaction_timeout'; -- 60000 ms
```

Whole-transaction duration includes time between statements; statement_timeout,
lock_timeout and idle_in_transaction_session_timeout bound different phases.
Those existing defaults are not changed by this optional SQL. A shorter
statement/lock/idle timeout can still fire first.
Local tests use real PG17 and a fresh role login. The below-17 branch is exercised
by substituting the version expression on PG17; this is **not** real PG16 testing.
No Supabase version inspection, application or recycling is performed here.

## Validation

See `docs/SECURITY_STOCK_REVIEW_VALIDATION.md` for ordered commands, counts,
browser findings and limitations.
