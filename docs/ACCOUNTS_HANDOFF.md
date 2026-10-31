# Step 5 — Google accounts and secure admin

## Scope and decisions

This delivery stops at Step 5. It preserves the screening engine, original brand
assets, database privacy/integrity triggers and public research. Deferred admin
sections are placeholders, not methodology, securities, ingestion, editions or
analyst workflows. Nothing was deployed. No external migration, seed, role grant
or MFA reset was executed.

Applied decisions: D-14 auth-only Supabase and no deployed secret; D-16 restricted
database roles; D-35 nullable account identity; D-38 editorial approvals remain
deferred rather than being invented here; D-40 private nonce security;
D-45–D-53 Google-only identity, database-owned roles, consent, TOTP/AAL2,
workspace-only recovery, nonce isolation and browser-only public account control;
D-70/D-76/D-78 review markers and fixed, id-only end-user audit records.
The decisions override the build reference, which was not edited.

## Files and dependencies

- `src/lib/auth/`: auth-only browser/server clients, validated return paths,
  current policies, registration, consent/role guards, transaction helpers,
  audited admin mutations/reads, private response headers and legal loader.
- `src/proxy.ts`: public requests use next-intl only. Private AR/EN auth/account/
  admin requests refresh auth while preserving localization and refresh cookies,
  forward a nonce/request path, and send private/no-store, noindex and strict
  script nonce CSP. Supabase is permitted in private connect-src. Public CSP and
  Cloudflare/preview gating remain Step 13 work.
- Public and private route groups own separate root documents. Only the private
  layout reads headers. Shared `LocaleDocument` does not inspect a request; its
  public theme script is fixed and private caller supplies the nonce.
- `src/app/[locale]/(private)/`: Google sign-in/start/callback/recovery,
  consent/accept and POST sign-out; minimal account; privileged admin shell,
  narrow TOTP bootstrap, Users, Audit and the two editorial settings.
- `src/app/api/account/profile/`: server `getUser`-verified, session-owned
  id/name/role only, including stale-consent accounts. Every response, including
  failures, is private/no-store with explicit CDN/Cloudflare no-store headers.
  Anonymous browsers never request it. Browser session changes abort requests,
  invalidate old responses and clear old roles. There is no public user API.
- `src/components/accounts/`: accessible bilingual forms/menu and shared
  paired copy dictionary. Unapproved Arabic is explicitly `⟦AR-REVIEW⟧` English;
  the supplied foundation lockup/value statement is reused.
- `content/legal/`: four Markdown files; exported policy constants and front
  matter both use `draft-2026-10-11`. Markdown rendering disables embedded HTML.
- `scripts/admin/`: isolated workspace-only ESM CLIs. They are not imported by
  application code. `SUPABASE_SECRET_KEY` is not parsed by runtime auth.
- `scripts/authorization-guard.ts` and tests: ts-morph resolves imported
  authorization symbols and checks the first awaited operation. Aliased/exported
  wrappers, shadowed imports, premature argument work, swallowed authorization
  failures and unsafe catch/finally branches fail fixtures. Health/internal and
  the future signature-checked hooks family are the only API exclusions. OAuth
  routes are outside `/api`; they retain explicit identity/origin validation.
- `tests/accounts.integration.test.ts`: real disposable PostgreSQL 17, auth
  mocked at its module boundary; a unique owned database is dropped afterward.
  `tests/browser-fixture/` is a separate test process bundling real UI against
  module-boundary auth fixtures. It cannot bypass auth in the actual Next app.
  CI runs these browser fixtures as well as foundation/production checks.
- Added `@supabase/ssr` and `@supabase/supabase-js` for auth (not the Data API),
  `react-markdown` for safe public policy Markdown, dev `ts-morph` for the
  authorization AST guard and dev `esbuild` for isolated browser component fixtures.

## New migration — review and authorization required

Only new `drizzle/0004_account_security.sql` and its journal entry were added.
Applied migrations were not modified.

1. `app.verified_totp_status(uuid[])` is a SECURITY DEFINER, empty-search-path,
   maximum-25-ID projection. It returns UUID and verified-TOTP boolean only.
   PUBLIC execution is revoked; only `suhail_app` receives execution. Admin-only
   application authorization precedes every call. It does not expose secrets,
   grant broad auth-table access or change a Supabase auth table.
2. Replaces the existing self-delete function with the same integrity/privacy
   behavior, adding the shared role-change lock and refusing **both** privileged
   roles. The SQL function still emits exactly one id-only deletion audit; the
   app emits no second event.

Managed-schema compatibility was checked against the official Supabase Auth MFA
migration (`auth.mfa_factors.user_id`, `factor_type`, `status`; enum values `totp`
and `verified`) and exercised on disposable enum-backed auth fixtures, including
unverified and non-TOTP factors and denied raw/public-role reads:
https://raw.githubusercontent.com/supabase/auth/master/migrations/20221003041349_add_mfa_schema.up.sql

This is not a live-project compatibility smoke test. Before an authorized
external application, review the new SQL, confirm the managed project's actual
auth columns and PostgreSQL function-owner access, and take the normal backup.
Use the existing Session-mode migration procedure in `PHASE_ZERO_DATABASE.md`
and `pnpm db:migrate` **only with explicit founder authorization**. Apply the
ordered journal rather than manually replaying older migrations. Do not seed,
reset or use the disposable integration harness on the managed project.
The app continues to use the restricted application role through dbApp/Drizzle.

## Configuration and manual onboarding

1. Configure Google OAuth in the Supabase project (Google provider only; disable
   unwanted email/password/phone/anonymous registration). In Google OAuth,
   authorize Supabase's provider callback URL from the project's Auth settings.
   Configure Supabase's site URL and a restrictive redirect allowlist for the
   exact authorized application origin and both `/auth/callback` and
   `/en/auth/callback`. Do not use broad production redirect wildcards.
2. Set only the public project URL and browser-safe anon key for app auth.
   Keep `DATABASE_URL_APP` as the existing restricted Session-mode runtime
   connection on port 5432 (D-139), also used by the separate public role.
   Keep `DATABASE_URL_MIGRATIONS` Session-mode workspace-only.
   Never deploy a Supabase service-role/secret key. No Replit Auth, Google
   identity scripts or Supabase Data API are used.
3. Apply the reviewed migration only when explicitly authorized, then test the
   verified-TOTP projection from the authorized admin read path.
4. Sign in with Google once, establishing the app user and consent.
5. In the workspace shell: `pnpm admin:grant <founder-email> admin`.
6. Open `/admin` (or `/en/admin`), enroll a TOTP authenticator with the QR or setup
   key, enter its current code, and enter admin at AAL2. Later AAL1 sessions go
   to verification, not directly to privileged data.

`pnpm admin:grant <email> <admin|editor>` requires an existing signed-in auth/app
user, serializes role changes/last-admin checks, and atomically audits as
`system:cli`. Admin UI role changes require a note and audit before/after.

Lost authenticator recovery is workspace-only:
`pnpm admin:reset-mfa <email>`. It refuses `NODE_ENV=production` and reads
`SUPABASE_SECRET_KEY` only from the shell. Supply it through the workspace secrets
flow; do not put it in runtime environment parsing or deployment settings.
Only TOTP factors are deleted. Remote deletions and the database audit cannot be
one transaction: the CLI records removed/failed factor IDs and partial failure,
or explicitly reports successful remote operations whose audit failed and need
manual reconciliation. Another admin must remove an admin/editor role before
that account can self-delete.

## Review and launch prerequisites (not implemented launch gates)

All four legal files begin with `⟦LEGAL-REVIEW⟧` and explicitly say they are draft
placeholders, not approved legal text. Human legal approval is required before
registration is launched. When substantive approved text replaces a draft,
assign a **new** policy version in both locale front matter and constants so
previous draft acceptance causes re-consent; do not silently reuse its version.
The later launch gate must inspect these markers, all `⟦AR-REVIEW⟧` entries and
the existing foundation review prerequisites. This step does not implement that
gate or silently approve copy. Account deletion retains required historical,
privacy-safe audit identity according to the existing database rules.

Step 13's general public CSP must explicitly allow the configured Supabase
origin in `connect-src` for the browser-only account control. A future CDN rule
must never cache `/api/account/profile`, regardless of authentication or status.
These requirements do not justify making public server rendering personalized.

## Verification and limitations

Automated evidence is recorded below after the final checks. Auth is mocked
only at boundaries; app users, transactions, audits, privileges and concurrency
use real disposable PostgreSQL 17. Actual CLI processes use that disposable
database and a local mock Supabase Admin API, never real users/credentials.
Browser fixtures exercise actual menu/consent/account/MFA components; they are
not a live Google/TOTP test or a screenshot of a real signed-in admin session.

The original Step 5 verification did not exercise live Google. Subsequent
navigation verification is described below; signed-in refresh/session cookies,
Google cancellation after account selection and authenticator enrollment/
step-up/reset still require authorized manual testing.

### Google navigation verification

Sign-in starts with a same-origin POST returning private/no-store JSON, then a
document navigation to the validated configured Supabase Google authorization
endpoint. `form-action 'self'`, script nonces/strict-dynamic, PKCE and
`frame-ancestors 'none'` remain in place. Public provider settings are checked
read-only with the browser-safe anon key before starting; disabled/unavailable
Google setup stays on the sign-in page with retry/new-tab/site-owner guidance.
The UI shows progress, prevents duplicate submissions and advises separate-tab
sign-in for unsupported embedded contexts. JavaScript is required.

Production callback/POST origins require HTTPS `SITE_URL`. Development also
supports the exact `REPLIT_DEV_DOMAIN` supplied by the environment and same-port
loopback aliases. Arbitrary forwarded hosts are never trusted. Set the canonical
origin before production deployment; configure Supabase's redirect allowlist for
both localized callback paths on every authorized origin. The live callback
allowlist and completed account registration have **not** been verified.

Browser regressions click the actual AR/EN screens, exercise the real Next start
route and SDK-generated PKCE/cookies, then follow an isolated external HTTP
redirect chain to a Google stand-in. These two route-integration cases require
a configured Supabase project with Google enabled and skip explicitly when
public auth configuration is absent; error and embedded-browser cases remain
independent fixtures. Unit cases cover disabled settings, malicious destinations,
CSRF/origin refusals and externally reachable callbacks.

Unauthenticated live preview clicks on both `/auth/sign-in` and
`/en/auth/sign-in` reached Google's sign-in page (start 200, Supabase authorize
302). Testing stopped before account selection, account creation or authorization.
No provider configuration, database data/roles or migrations were changed.

### Checks actually run

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass, no warnings in the final lint run |
| `pnpm lint:logical` | Pass |
| `pnpm test` | Pass: 363 tests in 16 files |
| `env -u DATABASE_URL_TEST pnpm test:db` | Pass: 107 tests (84 preserved database tests + 23 account tests), real disposable PostgreSQL 17 |
| `pnpm test:engine` | Pass: 186 tests; 100% statements/branches/functions/lines |
| `pnpm build` | Pass; public home/legal are prerendered, private routes dynamic |
| development Playwright full suite | Pass: 9 tests, foundation/accessibility/health and accounts |
| development accounts after final auth changes | Pass: 2 tests |
| `pnpm test:e2e:accounts` | Pass: 5 isolated browser auth-boundary fixture tests |
| production Playwright | Pass: 2 tests, including real framework nonce scripts, early light restoration, anonymous account control without profile requests, legal ISR and preserved health |
| standalone file tracing | Four legal Markdown files included; no workspace admin CLI/secret in traced app files |

Chromium checks used the environment-provided Chromium executable through
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Initial cold-start runs timed out; later
simultaneous production/dev runs contaminated generated dev output and caused
HMR reloads/missing response headers. The final development checks passed after
discarding only generated `.next/dev` output and running without a production
server/build alongside it. Keep these checks serialized.

The original database suite intentionally requires an **empty** disposable
database: restart `pnpm db:test:up` before a second full suite run. One attempted
repeat correctly rejected the already-populated disposable target; the final
107-test run used a fresh harness. Never relax this safety check to accommodate
a live database.
