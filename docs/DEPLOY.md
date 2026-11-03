# Phase 0 Autoscale operating guide

## SEC Notes-data dry run (D-142, D-154)

**Local v1.1 upper-bound comparison (D-154):**

```sh
pnpm sec:upper-bound:dry-run
pnpm sec:upper-bound:dry-run -- --dataset 2026_07
pnpm --silent sec:upper-bound:dry-run -- --summary
pnpm --silent sec:upper-bound:dry-run -- --summary --dataset 2026_07
```

Only run against SEC after the owner authorizes the dry run. Implementation was
verified with fixture HTTP only, with database credentials absent. This command
does not import, persist evidence, create a methodology version, advance a
workflow, screen live securities or connect to any database. No new deployment
variables, build commands or migrations are required.

It compares **every ticker in `data/launch/universe.csv`**, using each
companyfacts-selected annual filing's archive (monthly when available, otherwise
quarterly). The filing-month URL is attempted even when its catalog link is not
listed yet (for example `2026_10` before `2026q4`). HTTP 404/410 falls back to
the quarter; if both are missing the result says **archive not yet published**
and names both datasets. Download/missing-result reuse lasts only for that run;
the next invocation fetches the catalog and tries again. Access-denied,
throttling, transfer and parsing failures are not labelled non-publication.
An explicit `--dataset` remains exclusive to that listed archive; a mismatched
archive cannot supply evidence.
It reads covered accessions' SUB, NUM, BS PRE and (when present) CAL rows only. The existing SEC
User-Agent, process-local limiter and download limits apply unchanged.

`data/methodologies/al-rajhi-adapted-1.1-draft.json` holds the named
`annual_yield_assumption` (0.06) and explicit standard balance-sheet tag mapping.
`proposedV11Definition()` resolves the draft over the unchanged v1.0 definition
in memory; it does not write a database version. Normal source verification,
universe testing, approval, publication and production gates still apply.

### v1.1 draft installer and stored screening inputs (D-155)

**Implemented locally; not run against Supabase. Owner authorization is required
before either installer mode or a live refresh is run.**

```sh
pnpm setup:methodology-v11 -- --actor <existing-admin-email> --dry-run
pnpm setup:methodology-v11 -- --actor <existing-admin-email>
```

The dry-run uses a read-only database transaction. It validates the existing
admin, Al Rajhi adapted methodology, version 1.0 and its one eligible Verified
methodology document; no source is fabricated. The write command uses the
existing methodology lock and audited version/criterion/source services, in one
transaction. It installs the resolved v1.1 definition and named 6% parameter as
an unpublished draft. Identical repeat runs change no rows, timestamps or audit
events, including after normal workflow advancement. A partial/conflicting v1.1
(including a plain v1.0 clone) stops without repair or overwrite.

It never changes the parent, v1.0, examples, default, workflow stage, production
enablement or approval. It does not copy reports or mark tests as passed.
After installation, select version 1.1 in `/en/admin/methodologies` (Arabic:
`/admin/methodologies`) and take it through the ordinary source verification,
rule normalization, tests, universe testing, human review and approval gates.
Publication/production/default selection remain separate owner actions.
Do not use `setup:launch` to install v1.1.

During the existing SEC refresh, covered stocks missing companyfacts income
also prepare BS evidence from the same FSN download. Four normal sourced facts
store cash, short/long-term securities and a versioned completeness/context
record in `value_text`, including component states, tags/rows, filing link,
accession, fiscal end and revenue anchor. No full ZIP is stored and no new
table/migration is needed. Incomplete/unavailable refreshes supersede old
completeness. Existing income takes precedence; a refresh with income does not
download BS evidence merely to compute an unused bound.

Screen all, the screening job and universe/impact reports share a stored-input
reader. They do not download SEC data. Eligibility is derived from CURRENT
protected-income decisions and exact stored filing/period/revenue/component
agreement, not trusted as an old imported permission flag. A protected unknown
blocks fallback; reported/selected income (including zero and existing estimated
SEC/FSN proxies) wins. Only an opt-in v1.1 criterion receives the bound inputs;
v1.0 receives none and its historical inputs/replay are unchanged. The engine
computes the configured bound, never persists it as `prohibited_income`, and
continues to return unknown when it is incomplete or above the threshold.

The stored inputs' primary filing sources remain Verified; the assumption-based
result is Estimated. v1.1 criterion traces/source links retain the input amounts,
rate and Suhail-assumption explanation. Internal prepared inputs/context are
excluded from the ordinary public fundamentals table to avoid exposing raw
machine keys/JSON or changing v1.0's table. No new Arabic copy is approved here.
The read-only SEC comparison above still performs no database reads/writes and
does not establish actual stored screening status.

For every mapped stock the comparison shows cash, short-term and long-term
securities, their values/tags or the reason they are unknown, and the filing link.
Absent securities count as zero **only** when a complete BS presentation exists;
they are labelled **not on balance sheet**. Cash is required. Only potentially
cash/deposit/investment/securities lines **within Assets** can block completeness:
use each PRE report's Assets total/line order and CAL descendants without joining
calculation groups. Liability lines and unrelated custom inventory/prepaid lines
do not block. An unprovable asset boundary remains unknown, never zero.
Custom or unmapped financial asset lines, and a presented line with no unique readable
consolidated value is unknown. One total takes precedence over its presented
children; multiple alternative totals are ambiguous, never added together.

The bound and ratio are hypothetical. A complete ratio ≤5% previews a pass with
Estimated evidence; above 5% stays unknown, not fail. Existing reported/selected
income, including zero, wins. Analyst overrides and actual stored screening
impact require DB reads and are explicitly **not checked**. Draft engine inputs
require explicit eligibility after checking protected overrides; missing
eligibility cannot pass. The dry run's prepared inputs are illustrative only,
not importable live screening authority. The public criterion explanation and
calculation evidence identify the rate as Suhail's conservative assumption,
not part of the Al Rajhi document.

Both dry runs now print NUM revenue candidates, values, dimensions, date offsets,
and rejection reasons. `--summary` applies to the upper-bound command and emits
one line per universe ticker: cash, short-term, long-term, bound, ratio and
pass/unknown with its reason. It includes skipped tickers and absence labels.
When blocked, it also prints every blocker tag and PRE `plabel` (including
unreadable-component presentation rows), deduplicated without losing distinct
tag/label pairs. Missing labels are explicitly marked unavailable.
The summary also prints unreadable NUM candidates with values, dates, units,
dimension/context fields, `iprx` and rejection reasons (including WMT-style cash
ambiguity). `EquityMethodInvestments` is labelled **excluded: equity-method
investment** and is neither selected nor a blocker. A cash/short-term subtotal
appears once in cash; short-term is labelled **included in cash + short-term
subtotal**, not absent. Maturity is established with Assets/AssetsCurrent PRE
subtotals and CAL membership. Custom INTC `EquityInvestments` is approved only
for ticker INTC + CIK 0000050863 and the selected filing's custom namespace.
SIC 6000–6299 skips the bound: **not applicable: financial institution**.
Prepared evidence uses `sec-fsn-bound-2`; old preparations require refresh before
becoming eligible. No engine or companyfacts calculation version changes.

This is a hypothetical bound preview, not stored screening status. Existing
income taking precedence is labelled unknown/bound-not-used rather than implying
that a favorable bound overrides it. Full JSON remains the default.

SEC's [FSN specification §5.4](https://www.sec.gov/dera/data/fsnds.pdf)
defines `iprx` as an otherwise-identical-fact discriminator/priority index, not
a boolean primary-fact flag. Although the PDF describes positive integers,
the supplied output has zeroes; neither 0 nor 1 is excluded. Same-filing,
same-version, same-fiscal-context consolidated values are deduplicated by value,
not selected by `iprx`. Different values remain ambiguous, including competing
revenue values; a higher index never hides them.

The JSON diagnostics retain
context counts and individual rejection reasons. AAPL/PEP rounded FSN dates keep
the exact companyfacts fiscal dates. Offsets are preserved as NUM context keys,
not converted with a guessed unit; numerator and revenue must share that context.
Actual MSFT/TXN/NFLX/LLY causes require an owner-authorized dry run—the tests
demonstrate diagnostic behavior, not a conclusion from unrecorded live rows.

Deployment commands are unchanged. The workspace-only read-only command is:

```sh
pnpm sec:fsn:dry-run
# Optional archive override; does not permit mixing filings/periods:
pnpm sec:fsn:dry-run -- --dataset 2026_07
pnpm sec:fsn:dry-run -- --dataset 2025q4
```

Requires only the existing `SEC_USER_AGENT` and outbound HTTPS to SEC. No
database/Supabase credentials are needed or used. The command reads the committed
covered ticker list, resolves AAPL/MSFT/AMD/TXN/NFLX/PEP/LLY/XOM against SEC
listings and companyfacts, and selects archives from the official SEC Notes
catalog using each selected 10-K/10-K/A filing date: monthly when available,
otherwise quarterly. Stocks sharing an archive share one streamed download.
An override selects that archive for all eight but still rejects absent or
incompatible filing evidence; it will not necessarily cover every stock.

The command writes JSON to stdout only: matching fields/tags/values/periods and
filing links, rejection reasons, existing companyfacts income, and report-only
company-specific `Interest`/`InvestmentIncome` tags with values. No ZIP, report,
cache file, database row, audit event or screening result is written. It
explicitly skips status-change predictions: the production methodology,
current screening result and protected analyst corrections require database
reads, which this command does not perform. It does not claim that filling an
Estimated income proxy removes a security's review status.

The custom-tag allowlist starts empty and must remain exact and reviewed.
Suggestions are never mappings. Source provenance remains Verified, but D-124
income proxies remain Estimated with their warnings. Fallback facts carry
`sec-fsn-3` (D-154 asset-scope/iprx correction); companyfacts and screening keep `calc-2026.10.6`.

Normal future `job:ingest`/admin ingestion can use the fallback only for an
in-universe issuer with missing companyfacts prohibited income; protected
corrections and existing companyfacts values are not overwritten. Finish serial
ingestion before screening. No new scheduler, deployment command or migration
is introduced. **Do not run a real import as part of verification.** The founder
runs the dry run first and separately authorizes a real run; implementation
verification uses fixture HTTP only and disposable local PostgreSQL.

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
