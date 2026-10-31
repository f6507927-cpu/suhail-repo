# Phase 0 Autoscale operating guide

Local preparation only. Nothing here authorizes deployment, SQL, migrations,
imports, account sessions or hosted setting changes. D-139 records the founder's
reported facts, not independently verified service evidence.

## Public but unindexed

Keep **SITE_MODE=preview** until the founder separately authorizes live mode.
Anyone with the URL can browse public pages, assets, APIs and robots without a
preview password (D-137, latest confirmation). No preview credentials are needed.
Do not configure `PREVIEW_BASIC_AUTH_USER` or `PREVIEW_BASIC_AUTH_PASSWORD`;
their hosted values were not read or changed here. Preserve route-specific
Supabase sign-in, consent, roles/MFA, rate limits, nonce/CSP and private data guards.
Every preview response, including health, assets, redirects and errors, carries
`X-Robots-Tag: noindex, nofollow`; robots has `User-agent: *` / `Disallow: /`.
Do not submit a sitemap. Noindex is not access control.
Documents/RSC remain no-store; hashed Next static assets remain immutable.

## Commands and platform controls

The committed `.replit` uses supported `[deployment]` keys with
`deploymentTarget = "cloudrun"` (Replit Autoscale):

- Build: `pnpm install --frozen-lockfile && pnpm build`
- Run: `pnpm start`
- Health path requested: `/api/health` (200; independent of database, provider and
  auth configuration). No build/start hook runs migrations, seeds or imports.

The existing start command binds `0.0.0.0` and `${PORT:-3000}`; keep the platform
port mapping and do not hardcode a development hostname in the application.
Node 22 / pnpm 10 are pinned by the project.

Future operator: select Autoscale in Publishing → Adjust settings → Machine
configuration. Phase 0 requires **minimum 1 / maximum 3 instances**. Set maximum
3 there. Configure minimum 1 and health path `/api/health` only using supported
dashboard controls if offered; these are not invented TOML fields. Current
Replit documentation describes Autoscale scaling down to zero and a root-path
startup check, but does not establish a configurable minimum or health-path
field for this account. **Before deploying, resolve availability of minimum 1
and custom health checks with the platform; do not silently replace 1–3 with
0–3 or claim either setting was applied.** If unavailable, stop for a founder
decision. `/` must also start within the platform's health-check budget.
No dashboard settings were changed or hosted availability checked here.

Sources: [configuration](https://docs.replit.com/features/project-setup/configuration),
[machine configuration](https://docs.replit.com/features/publishing/machine-configuration),
[publishing troubleshooting](https://docs.replit.com/build/troubleshooting).

## Deployment variable inventory

Names only; no real values or credential-bearing URLs belong in this guide.
Runtime values belong in the intended deployment environment, not just workspace
settings. Only the two `NEXT_PUBLIC_*` values are browser build inputs; Next
freezes them at build time, so changing them requires a rebuild.

| Variable | Classification | Required / when | Timing |
| --- | --- | --- | --- |
| `SITE_MODE` | public configuration | Required operational value: `preview` | runtime; keep consistent at build |
| `SITE_URL` | public configuration | Required assigned HTTPS origin | server runtime / metadata |
| `DATABASE_URL_APP` | secret | Required restricted app role | runtime only, lazy |
| `DATABASE_URL_PUBLIC` | secret | Required restricted public role | runtime only, lazy |
| `SUPABASE_DB_CA_CERT` | public PEM CA configuration | Required verified TLS | runtime only, lazy |
| `NEXT_PUBLIC_SUPABASE_URL` | public configuration | Required auth project URL | browser build + server runtime/CSP |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser-safe public anon key | Required Google auth | browser build + server runtime |
| `SEC_USER_AGENT` | private identifying configuration; store as secret | Required for admin SEC lookup/ingest, not health or build | runtime on SEC action |
| `FORWARDED_DIAGNOSTICS` | configuration | Optional, off unless `1`; temporary count/classification logs | runtime |
| `JOB_BATCH_SIZE` | configuration | Optional positive integer, default 100 for workspace jobs | job runtime |
| `GIT_SHA` / `GITHUB_SHA` | public build metadata | Optional; otherwise local git SHA | build |
| `PORT` | platform-supplied configuration | Platform binding; start defaults to 3000 if absent | runtime |

Actual consumers: site/auth/SEC schemas in `src/env`, auth browser/server clients,
runtime database factories, `src/security/forwarding-diagnostic.ts`, jobs and
`next.config.ts`. Storage currently has a schema (`src/env/storage.ts`) but **no
active storage consumer**. Consequently `S3_ENDPOINT`, `S3_REGION`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_PUBLIC` and
`PUBLIC_MEDIA_BASE_URL` are **not current deployment requirements**. If a storage
consumer is later approved, the two access keys are secrets and the other four
are configuration; establish its actual runtime needs then.

**Exclude from deployment:** `SUPABASE_SECRET_KEY`, `DATABASE_URL_MIGRATIONS`,
`DATABASE_URL_TEST`, every other test-only URL or setting (including Playwright
server/fixture, benchmark, local DB bootstrap and `POSTGRES_TEST_BIN` settings).
Never deploy generic `DATABASE_URL` / `PG*` credentials, workspace CLI owner keys
or test adapters. No `SESSION_SECRET` consumer is present; it is not required.
Deferred under D-54 (mapped to D-63): `ANTHROPIC_API_KEY`, `LLM_MODEL`,
`REVALIDATE_SECRET`, `S3_BUCKET_ARCHIVE`, `SEND_OTP_HOOK_SECRET` and future OTP
provider configuration. Do not request these for this deployment.

## Session pooler and connection capacity

For **both** runtime URLs use the exact Supabase Connect dialog's Session pooler
host on **5432**, retaining distinct existing project-qualified usernames
`suhail_app.<PROJECT_REF>` / `suhail_public.<PROJECT_REF>`. Never construct the
host, reuse the owner login or weaken D-91/D-94 identity/TLS controls.
Keep explicit CA/hostname verification, `prepare:false`, `max:3`,
`max_lifetime:1800` seconds and postgres-js `keep_alive:30` seconds (TCP
keep-alive). Lazy imports/builds, ambient-credential refusal and disposable
loopback-only tests remain. No timeout-policy change is made.

Founder-reported incident: postgres-js pipelining stalled through Transaction
6543, with `pg_stat_activity` showing active / ClientRead sessions up to **4,893
seconds**; the founder reports app/public URLs now use Session 5432. This was
not reproduced here. Lifetime/keep-alive do not prove cancellation or cure
every stall; preserve server-side limits and investigate effective settings
separately with authorization.

Founder-supplied hosted facts: Session pool size **15 per user+database
combination**, separately for app and public; Nano has a separate fixed
**200-client** limit. They were not independently checked.

| Steady-state pool | Budget at 3 instances | Headroom |
| --- | --- | --- |
| suhail_app + database | 3 × 3 = 9 ≤ 15 | 6 |
| suhail_public + database | 3 × 3 = 9 ≤ 15 | 6 |

Together these are 18 web client connections, below the separate 200-client
limit, **not** 18 competing for one shared 15-slot pool. Workspace previews,
scripts and draining old releases must count too. `setup:launch` uses app:
one extra app-only three-connection script raises app demand to 12. Migrations
use `postgres`, a distinct user/database pool, but consume overall clients.
Keep ingest/screen serial. Include all other clients in the 200-client total.

**Bounded release procedure:** steady-state maximum 3 alone does not bound old/
new rollout overlap. Full 3-old + 3-new needs 18 **per role**, before scripts,
and cannot fit 15. Before release stop/drain workspace previews and nonessential
scripts; finish ingest before screening and finish jobs before release. Confirm
actual per-role clients and platform rollout behavior with authorized operators.
Drain old instances/connections before admitting enough new instances to exceed
**five total live web instances** (5 × 3 = 15 per role, with no script headroom).
Prefer drain-to-zero old releases before bringing up the new 1–3 instances,
accepting a maintenance gap. If the platform cannot guarantee a bounded/drained
rollout, stop rather than assuming spare capacity. Account for the shutdown
delay and old pool lifetime; verify old clients have closed before proceeding.
Keep the requested steady-state 1–3 limits unchanged. Do not alter hosted URLs,
pool sizes, roles, role defaults or schema as part of this preparation.

## Callback setup — future operator only

Placeholders, not approved actual origins:

| Setting | Assigned Replit origin | Future custom origin |
| --- | --- | --- |
| HTTPS origin / `SITE_URL` / Supabase Site URL | `https://<ASSIGNED_APP>.replit.app` | `https://<APPROVED_CUSTOM_HOST>` |
| Supabase redirect allowlist (Arabic) | `https://<ASSIGNED_APP>.replit.app/auth/callback` | `https://<APPROVED_CUSTOM_HOST>/auth/callback` |
| Supabase redirect allowlist (English) | `https://<ASSIGNED_APP>.replit.app/en/auth/callback` | `https://<APPROVED_CUSTOM_HOST>/en/auth/callback` |

Use exact approved origins, no broad production wildcards. On a domain change,
update `SITE_URL`, Supabase Site URL and the restrictive allowlist together;
retain old exact callback entries only during an approved transition.
In Google OAuth, **authorized JavaScript origins** (if required) are bare
approved app origins above, not callback paths. Google's **authorized redirect
URI** is the Supabase project's
`https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`, copied from that
project's provider configuration. The application's `/auth/callback` and
`/en/auth/callback` belong in Supabase's allowlist, **not** Google's provider
redirect URIs. No Supabase/Google/domain configuration was changed or tested.

## Release, rollback and data freshness

After separate authorization, first run **`pnpm db:migrate` from the workspace
shell**, using its owner migration credential, then deploy the reviewed build.
This is documentation, not authorization to run it now. Build/run hooks never
migrate/seed/import. Keep schema changes backward-compatible for one release.
Rollback redeploys the previous build; **no down-migrations**.

D-20: each instance has an independent ISR cache with `revalidate = 900`.
There is no shared cache; best-effort revalidation cannot synchronize instances
or promise immediate updates. Allow 900-second freshness limitations and
stale-on-error behavior; preview no-store is downstream, not an ISR disable.

Scheduled deployment work remains deferred. Operators run **Ingest all, then
Screen all, serially**. Enter all **three month-end closes per required quarter**
before screening under the existing quarterly evidence workflow. No automatic
refresh or hosted schedule is introduced here.

## Local smoke and open gates

`pnpm smoke -- --base <url>` checks `/`, `/en`, `/api/health`, `/robots.txt`
without credentials: 200, security/CSP, explicit noindex + nofollow, no-store
and wildcard robots disallow-all. Four bounded sequential read-only GETs, no
redirect following, sign-in, admin action, SQL or refresh; sanitized failures
exit nonzero. HTTP is permitted only for loopback fixtures; hosted targets must
use HTTPS. It does not test real OAuth/MFA or platform readiness.

O-7 remains **open**. The four locale legal bodies are founder-supplied drafts,
Arabic first/source language, with unchanged `draft-2026-10-11` consent versions.
The explicit draft banners and review markers are not legal approval.
[Lawyer questions](LEGAL_REVIEW_QUESTIONS.md) preserve the attachment's unresolved
supporting material outside consent text. All operator/contact/region/version/
date and `[CONFIRM]` placeholders remain unresolved. Draft statements do not
authorize changing product screening labels or implementing future features.
O-6 residency/PDPL and separate launch/methodology/Arabic gates still apply.
Hosted smoke, real account sessions, callback checks, pool/rollout capacity and
dashboard minimum/health controls must be verified later with separate approval.

## Local verification record — 22 October 2026

- `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`: passed.
- `pnpm test`: **1,214 tests / 76 files passed**, including 34 smoke fixture/CLI
  tests, 10 legal-source/render checks and the existing private authorization
  regressions. Legal hashes pin the attachment's specified four line ranges;
  approval-history fixtures are unchanged.
- `pnpm build`: passed with no database or Supabase configuration. Builds and
  checks used an allowlisted local environment, not saved service credentials.
- `pnpm exec playwright test --config playwright.security.config.ts`:
  **9 Chromium tests passed** against a credential-stripped local production
  server. All four legal routes, redirect/error/static preview headers,
  immutable chunks, sign-in/private nonce and rate limits were exercised.
  No real Google, Supabase or MFA session was used.
- `pnpm smoke -- --base http://127.0.0.1:5000`: all four checks passed against the
  isolated local production server; fixture tests cover failure/timeout cases.
- Arabic Privacy page visually checked in the local running production build.
  `pnpm ar-review:list` regenerated the two pending legal rows under their
  original IDs, preserving review status and all historical approval fixtures.
- Existing tool advisories remain: Vitest's native-config advisory, and Next's
  standalone-output advisory when using the explicitly requested `pnpm start`.
  The requested start command served the local checks successfully; no alternate
  deployment command or hosting behavior is claimed.

Changed areas: local `.replit` deployment commands; runtime pool options and
Session-port probe/tests; maintained database/account/launch guidance and
D-24/D-91/D-94/D-139; this operating guide and `.env.example`; four legal bodies,
localized banners/provider table renderer and separate lawyer questions; Arabic
pending inventory generation and narrow draft regressions; smoke CLI/package
script and local browser/header regression tests.

**Migrations added: none. Dependencies added: none.** No deployment, hosted
configuration/URL/role/pooler change, schema change, migration execution, SQL
probe, seed/import, data refresh or live service verification was performed.
Hosted checks remain **not run**. Local verification workflows were stopped and
their original commands restored after the checks.
