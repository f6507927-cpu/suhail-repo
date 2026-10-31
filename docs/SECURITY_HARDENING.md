# Security and preview hardening

## Reused controls

Private Supabase refresh, random per-request nonce/strict-dynamic policy,
spoofed nonce/path stripping, next-intl request overrides, refreshed cookies,
auth-first/AAL2/transaction AST guards and localized/root recovery screens are
retained. No authentication, role, database connection or recovery UI bypass
was added. Public rendering does not inspect request headers/cookies.

## Completed locally

- D-137 removes the preview Basic Auth gate by founder request. Public preview
  browsing needs no extra credentials; private authentication/role/MFA guards
  remain unchanged. Preview URLs are not an access-control boundary.
- Runtime preview noindex on proxy responses, dynamic preview robots disallow,
  global security headers plus D-40 fixed public / nonce private CSP. External
  form destinations are restricted to configured Supabase and Google.
  Public theme restoration and client account controls remain unchanged.
  Preview responses are downstream private/no-store even when Next's internal
  public ISR entry is retained. Private content remains uncached.
  Live public ISR keeps its cache headers.
- D-136 local search/auth/API token buckets. All methods count, including empty
  queries, RSC/prefetch and redirect aliases. Limits are independent by category,
  shared by path/locale within a category; no raw IP/query is logged.
- Successful public-affecting admin changes revalidate the consuming stock,
  search and methodology page patterns in both locales. Read-only verification,
  lookup, unchanged screening and failed mutations do not invalidate public
  pages. D-20 still applies: 900-second ISR, best-effort invalidation per instance,
  not cache coordination across independent Autoscale instances.
- An explicit access-level route inventory with AST discovery and failure
  fixtures; existing authorization scanners still independently enforce guards.
- Node-only built-output secret scanner, requiring nonempty static inputs and
  server-reference manifests. Reports filenames/rule names only. An exact SDK
  `.startsWith("sb_secret_")` classifier is inert and exempt; standalone markers
  and actual key values still fail. No file/chunk allowlist.
- CI retains gitleaks, scans after the credential-free build, and runs production
  dependency audit non-blocking. Safe runtime diagnostics accept only event,
  category and bounded HTTP status allowlists, never arbitrary errors/fields.

## Boundaries and verification

No migrations, seeds, imports, live Supabase access, production settings, domain
or Cloudflare changes, deployment or new dependencies are part of this work.
Browser servers explicitly select preview or live mode.
Privileged hydration checks substitute IO in an ignored copied Next project,
never enable a production authentication bypass.

Cloudflare templates remain disabled. Local token buckets reset on restart and
are not global limits; trusted platform forwarding, real Google/TOTP sessions,
and independent hosted caches require separately approved hosted checks.

## Local verification results

- `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`: passed.
- `pnpm test`: 1,131 passed.
- `pnpm test:db`: 218 passed against owned disposable PostgreSQL 17.
- Credential-free `pnpm build` and `node scripts/scan-bundle.mjs`: passed.
- Production preview browser suite: 4 passed (gate, health/assets/metadata,
  headers, nonce, OAuth cancellation, limiter burst/locale/identity/refill).
- Isolated production hydration suite: 4 passed, both themes and locales across
  real public/account/admin roots, script nonces and no console/hydration errors.
- Live-mode desktop security/search subset: 5 passed, 2 database-available checks
  intentionally skipped using CI mode; real database behavior is covered by the
  separate disposable integration suite, not inherited live credentials.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities found.

Hydration/navigation suites use distinct synthetic local clients per test phase
so automatic auth-link prefetches are not confused with the dedicated limiter
tests. Prefetches still count in application code. These are direct local HTTP
tests, not proof the hosted platform appends a trusted last forwarding entry.
