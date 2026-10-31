# Performance and hanging: verification record

Current connection instructions are in [DEPLOY.md](DEPLOY.md), D-139: both
runtime roles now use Session 5432 following the founder-reported pipelining
incident. The Transaction 6543 measurements below are historical evidence,
not current connection guidance. No hosted probe was rerun for this change.

## Delivered scope and remaining limits

The founder chose **“Continue the other fixes; leave database timeouts
blocked”** after the failed effective-setting gate below. No alternate timeout
strategy or live database change was approved.

- Run now starts only `Start application`; all five validation workflows remain
  available on demand. `Start (production)` runs exactly
  `pnpm build && PORT=5000 pnpm start`.
- Identity, consent-mode user guards, and normalized role-set guards use React
  request-local memoization. Layout, page, loader, route and action guards
  remain in place. No shared authentication cache was introduced.
- MFA uses the exact access token passed to successful `getUser(token)` and
  that call's returned factors, never cookie-user factors. Guard MFA calls to
  `listFactors` and the assurance helper were removed; enrollment-screen factor
  listing remains. D-47's verified **TOTP** enrollment is required at every
  privileged guard, even for AAL2; another verified factor or a still-valid
  token after TOTP removal is not sufficient. With verified TOTP, AAL2
  succeeds and AAL1 needs verification. Without it, enrollment is required.
  Invalid claims fail closed.
- The five methodology reads run together after authorization, retaining their
  original filters, selected source fields, ordering and returned structure.
- Profile headers and body consumption have a single eight-second deadline.
  Timeout shows the existing sign-in/error state. Replacement, sign-out and
  unmount cancel only the request they own; late results cannot restore roles.
- Runtime database settings, CLI settings, TLS, connection targets, pool size,
  prepared-statement policy and database-role verification were not changed.

### Workload discipline

Stop every application workflow before validation. Run checks serially.
Stop development before starting production, and vice versa; do not share
concurrent Next build output. Stop all app/check workflows for fixture timing,
and run only production for public stock timing.

One production startup attempt encountered an automatically resumed development
server on port 5000. That attempt was discarded. Both workflows were stopped,
the port/process state was checked, and the production workflow was then built
and started successfully in isolation. No measurements below came from the
failed attempt. Final methodology samples were also recaptured with process
checks confirming no main dev/production or validation processes before and
after the measurement batch. Next emits the existing `output: standalone`/`next start`
warning; the requested command nevertheless served the tested documents.

## Isolated methodology fixture — not live-admin latency

Environment: Replit Linux workspace, Node 22.22.0, pnpm 10.26.1,
Next 16.4.0, React 19.3.0. No live Google/TOTP session or provider requests.
No development server for the main application, production server, validation
command, disposable database, or browser workload ran alongside these timings.

The harness runs the actual proxy function, SDK, server auth, guards, protected
layout, methodology page and loader. Only outbound provider fetch, cookie/header
storage, database execution, translations and client-component boundaries are
fixtures. Provider verification and each database read have a fixed **15 ms**
delay. The five data collections are empty; the user row is a fixture admin with
current consent and a non-expired AAL2 token. The provider's returned factors
are independent from cookie-user factors. There is no signature verification
against a real Supabase project in this fixture.

The HTTP variant uses a generated, credential-free **Next development
(Webpack) test server**, its real RSC request-cache context and HTML rendering,
and full GETs of `/admin/methodologies` over loopback HTTP. The wrapper invokes
the actual proxy function using a fixture `NextRequest`; it is not a second
deployed proxy hop. The real layout/page functions execute within that server
render. Client UI is replaced with simple server-rendered collection markers,
so this does not measure the full interactive admin UI, real database
latency, network geography, real authentication, or hosted production latency.

An unchanged-code RSC baseline was captured before the application changes.
The final, matched HTTP comparison replays the original guard/loader files from
baseline Git reference `f1ca150be746fb03a7f349aa65cb983f3ac4a137` through the
same final harness as the changed files. No working-tree rollback is needed.
Each variant starts a separate generated server process/directory. Existing
compiler/disk caches can remain. The first document is reported separately and
includes **first-request target-page compilation**; “cold” here means a new
server process, not an emptied compiler/disk cache or a production cold start.

### Full HTTP document measurements

Each side: **11 samples: one cold plus ten warm**, all HTTP **200**, full
documents, no client navigation. Warm requests use a reusable HTTP connection,
`cache: no-store`, and a force-dynamic fixture page. Units: milliseconds.
Median is the mean of the two central samples; p95 is nearest-rank (the maximum
for ten samples).

| Metric | Before | After |
| --- | ---: | ---: |
| First/cold TTFB, including compilation | 5644.13 | 4601.66 |
| First/cold total document time | 5649.19 | 4606.01 |
| Warm TTFB median | 289.95 | 143.93 |
| Warm TTFB p95 | 303.03 | 726.70 |
| Warm total document median | 294.26 | 145.46 |
| Warm total document p95 | 304.50 | 734.70 |
| Auth HTTP calls per document, including proxy | 7 | 2 |
| Role lookups per document | 3 | 1 |
| Maximum simultaneous methodology reads | 1 | 5 |

In this fixture only, warm median TTFB fell **146.02 ms (50.4%)** and
warm median document time fell **148.80 ms (50.6%)**. The after samples were
recaptured after restoring the explicit TOTP-enrollment requirement during
completion review. **Observed HTTP p95 increased**, driven by the first warm
sample; no samples were filtered. This ten-warm-request fixture does not
establish an improvement in tail latency. These are not claimed live-admin
speedups.

Warm raw samples, in request order, **TTFB / total ms**:

- Before: 288.65/290.16, 289.52/292.74, 289.43/292.86, 299.16/300.72,
  290.38/297.32, 282.45/283.91, 291.65/298.93, 303.03/304.50,
  288.38/294.60, 292.85/293.91.
- After: 726.70/734.70, 123.25/125.57, 102.31/103.70, 160.19/162.97,
  136.02/138.81, 176.61/177.82, 132.98/134.50, 158.72/168.68,
  145.32/146.37, 142.55/144.54.

The separate RSC-only harness (same 1+10 sample workload, no HTTP server) gives
warm median first-stream-byte/completion times of **65.87/238.43 ms before**
and **49.61/66.90 ms after**, with p95 **71.39/246.29 ms before** and
**52.33/69.70 ms after**. Its cold first-byte/completion values are
**86.00/260.22 ms** and **68.23/86.47 ms**. These stream values are not HTTP
TTFB/document durations and are not combined with the HTTP table.

### Reproduction

With application and validation workflows stopped:

```sh
# Historical guards/loader, current matched HTTP harness:
pnpm exec tsx scripts/performance-fixture.ts --http-render --baseline \
  --baseline-ref=f1ca150be746fb03a7f349aa65cb983f3ac4a137
# Changed guards/loader, same workload:
pnpm exec tsx scripts/performance-fixture.ts --http-render
# Real RSC memoization, denial, token binding and isolation regressions:
pnpm exec tsx scripts/performance-fixture.ts --test
# Real browser-submitted Next Server Action POSTs:
PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v chromium)" \
  pnpm exec tsx scripts/performance-fixture.ts --http-actions
```

Generated app copies, bundles and raw output belong under ignored
`generated-artifacts/`. Never run these harnesses against live databases.

## Server Action finding — measured separately from rendering

The installed Next authentication guide explicitly says React `cache` does not
deduplicate actions outside a render pass. Both a direct Next action-context
test and a browser-submitted **real Next Server Action HTTP POST** confirmed:

| Actual exported bulk action, with three fixture mutation callbacks | Auth calls | Role lookups | Transaction locks | Role rechecks after lock |
| --- | ---: | ---: | ---: | ---: |
| Ingest | 4 | 4 | 3 | 3 |
| Screen | 4 | 4 | 3 | 3 |

The initial action guard and each `withAdminAction` call verify separately.
The HTTP test asserts the request carries Next's action-dispatch header.
The real bulk action and guard/transaction wrapper execute, but job callbacks,
provider transport and database operations are fixtures; no SEC ingestion,
live data writes or real MFA are tested. **There is no action-caching claim.**
No new action/global cache or removed role recheck was used to lower counts.

A fixture cancellation at the lock propagates to the actual bulk action's
existing failure text, with zero commits and one rollback. Separately,
disposable PostgreSQL 17 cancels a genuinely contended
`pg_advisory_xact_lock(73501947)` with SQLSTATE `57014`; its transaction rolls
back, its callback never runs, and the same single-connection pool can
successfully query again. The browser UI displays the existing failure and
re-enables submission. The production advisory lock was never taken.

## Public stock production-mode measurement — usable-data blocker

A read-only query through actual `dbPublic` found **no in-universe security
slug**. No live rows were created or changed to manufacture a benchmark.
Consequently, a matched **published-stock-page** timing is unavailable.

For transparency, production-mode Replit observations for the same attempted
slug, `/en/stock/nasdaq-aapl`, are below. **All 22 responses were 404**, so
these are missing-page availability measurements, not stock-page performance
or a speedup/regression claim.

Environment: same Replit workspace and HTTPS development preview origin,
`pnpm build` then `PORT=5000 pnpm start` (not a production deployment).
Before used the unchanged application build; after used the requested
production workflow. No competing development/validation workload. One first
request after startup plus ten subsequent requests on each side. New `curl`
process/connection per request; TTFB and total include the Replit proxy,
connection and TLS costs. First-request ISR/missing-page state is separated
from subsequent warm requests; browser cache is not involved.

| 404-only metric (ms) | Before | After |
| --- | ---: | ---: |
| First/cold TTFB | 409.93 | 546.38 |
| First/cold total | 410.53 | 549.70 |
| Warm TTFB median / p95 | 26.08 / 33.10 | 31.02 / 51.99 |
| Warm total median / p95 | 27.63 / 34.50 | 31.43 / 53.00 |

Warm raw TTFB/total ms:

- Before: 29.50/30.02, 24.67/28.48, 30.21/30.65, 30.14/31.37,
  25.80/26.24, 24.16/24.61, 22.58/22.93, 33.10/34.50,
  26.36/26.78, 22.01/22.42.
- After: 30.08/30.24, 30.97/31.55, 47.02/48.18, 51.99/52.99,
  30.62/31.07, 25.47/28.01, 32.65/34.79, 27.37/27.57,
  31.06/31.32, 41.55/41.80.

Reproduce only after stopping dev/check workflows and starting production:

```sh
for i in $(seq 0 10); do
  curl -sS --max-time 20 -o /dev/null \
    -w "$i status=%{http_code} ttfb=%{time_starttransfer} total=%{time_total}\n" \
    "https://${REPLIT_DEV_DOMAIN}/en/stock/nasdaq-aapl"
done
```

Use an actually published slug for the outstanding valid stock-page check,
and require HTTP 200 plus the expected stock document before accepting it.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`: passed.
- `pnpm test`: 58 files, 1013 tests passed after syncing with main and restoring
  the explicit TOTP requirement.
- `pnpm test:engine`: 225 tests passed; all production engine coverage metrics
  remain 100%.
- `env -u DATABASE_URL_TEST pnpm test:db`: 198 disposable PostgreSQL tests
  passed, including real advisory-lock cancellation and existing role/consent
  enforcement. The concurrent methodology loader is compared to its original
  serial query/field/order contract.
- Account/financial browser coverage: 41 existing/new non-deadline cases
  passed, including cancelled bulk work leaving pending state. All four
  profile deadline/race tests passed after freezing the fixture clock; these
  verify 7999 ms remains pending and 8000 ms leaves pending for header/body
  stalls, late roles, new sessions, sign-out and unmount.
- Real Next HTTP methodology fixture: 22 successful documents, with the
  expected before/after call counts and concurrency in every sample.
- Real Next HTTP bulk action dispatch: ingest, screen and cancellation cases
  passed independently of render tests.
- Privileged negative cases include AAL2 after TOTP removal, unverified TOTP,
  verified non-TOTP factors at both assurance levels, and cookie-factor
  spoofing. None may grant access or bypass the enrollment destination.
- Production-mode home screenshot: rendered normally with the sign-in state.
  **Signed-in live admin UI was not visually verified**; no live TOTP session
  was requested. Live-admin and valid published-stock timings remain unavailable.
- No dependencies, migrations, live imports/seeds, external account/role/MFA
  changes, deployment, translations or redesign were added.

## Database timeout gate — blocked

Read-only check run from the Replit workspace on 2026-10-18:

```sh
pnpm exec tsx scripts/db/check-runtime-timeouts.ts
```

The check builds an ignored, isolated bundle of the actual `dbPublic` and
`dbApp` modules, injecting only candidate startup parameters into
`runtimeOptions`: `statement_timeout=10000` and
`idle_in_transaction_session_timeout=10000`. Production connection-target
validation, port 6543, TLS certificate/hostname verification, pool settings,
disabled prepared statements, and runtime database-role verification remain
in effect. CLI connection defaults are unchanged.

| Client | Connection and role verification | Port | Effective statement timeout | Effective idle-in-transaction timeout | Accepted |
| --- | --- | --- | --- | --- | --- |
| dbPublic | Succeeded | 6543 | `2min` | `0` | No |
| dbApp | Succeeded | 6543 | `2min` | `0` | No |

Both `SHOW` queries completed for both clients. The candidate startup values
were not effective; connection success alone does not establish timeout
coverage. The script exited with status 1 as intended. It prints no credentials,
connection strings, provider tokens, or raw driver errors.

**Stop condition:** Do not ship these startup options as timeout protection.
No application settings, live roles, migrations, seeds, or advisory locks were
changed by the check. The following remain alternatives for a future,
separately approved decision:

1. Separately approve a migration using role-level `ALTER ROLE ... SET`,
   including its wider effect on connections using those roles. Do not apply
   it as part of this task without separate approval. Recheck effective values
   through both real runtime clients afterward (now Session 5432 under D-139).
2. Approve transaction-local `SET LOCAL` timeouts in action transactions.
   These can protect the advisory-lock wait and statements in those
   transactions, but **do not protect public reads outside those transactions**.
   Full public-read timeout coverage needs a separate decision.

The founder chose to continue the other fixes and leave database timeout
delivery blocked. Timeout coverage is **not complete**; the successful
disposable cancellation test does not establish hosted timeout settings.
All workflows were stopped before this check; no dev server or validation
workload ran alongside it.

## Founder-run live admin measurements (before and after merge)

No live TOTP session needs to be shared with the implementer.

1. Use the same origin, `/admin/methodologies` URL, browser, and successfully
   TOTP-authorized session before and after merge.
2. Run only the production workflow:
   `pnpm build && PORT=5000 pnpm start`. Stop the development server and all
   validation workloads first. Production and development must not run
   concurrently against the same build output.
3. Open browser DevTools, select **Network**, choose **No throttling**, and
   enable **Disable cache**. Keep DevTools open throughout.
4. Select the **Document** filter and clear the network log.
5. Perform a full page reload, not client-side navigation.
6. Confirm the final document is a successful admin page, not a sign-in,
   consent, enrollment, verification, or other redirect response.
7. Open that document's **Timing** tab. Record **Waiting for server response
   (TTFB)** and the total document duration, in milliseconds.
8. Record the first/cold reload separately. Clear the log and perform five
   subsequent warm full reloads, recording both measurements for each. Sort
   each set of five warm measurements and report the middle value as its
   median. A browser-cache-disabled reload does not necessarily clear
   server-side caches; note the server restart/build and cache conditions.
9. Repeat these steps identically after merge, with no competing workloads.

Share timing numbers, final status, cold/warm labeling, and workload conditions
only. Do not share cookies, headers, tokens, or an unsanitized HAR. Fixture
measurements, when available, must be reported separately and never labeled
as live-admin measurements.
