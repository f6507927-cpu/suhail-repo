# Stock verification follow-up validation

Validated on 2026-10-16 using Node 22.22.0 (both the shell and pnpm runtime).

## Delivered behavior and decisions

- **D-121** identifies the date-display policy. D-107 identifies only Arabic
  batch-2 approval. The decision-table audit found no duplicate IDs and exactly
  one definition of each. Remaining tracked D-107 references concern Arabic
  approval, not dates.
- **D-107 evidence is unchanged:** the batch-2 approval fixture, its approval
  document, approved translations, message JSON and the founder-owned build
  reference have no diff. The two new verification phrases remain English
  review-marker placeholders in the pending Arabic inventory. No new Arabic
  translation or approval was invented.
- Both stock social images use the existing absolute-URL builder and
  `/icons/icon-512.png`, in either locale. The fixture serializes the actual
  metadata, serves PNG bytes, and checks the absolute URLs, MIME type, signature
  and 512-by-512 dimensions. No Step 12 image generation was introduced.
- **D-78/D-91/D-120:** the stock suite validates its effective loopback target
  before launching any command or connecting, preserves the local default,
  honors CI's explicit database/port, and replaces inherited migration/app/public
  targets. It runs `pnpm db:migrate` and `pnpm db:seed:demo --test` with explicit
  preview mode, then enables the disposable public login. The application and
  seed safety guards are unchanged.
- CI runs the stock suite after installing browsers in the existing PostgreSQL
  service job and retains the existing generated-artifacts upload. Full database
  bootstrap ordering is unchanged.
- **D-43/D-89:** verification always checks the canonical stored-payload hash.
  Only a current-engine payload is reconstructed and replayed. Another stored
  engine version returns `replaySupported: false`, `replayMatches: null` and its
  actual version. An intact hash produces “Hash verified.” and “replay not
  supported for engine X”; a bad hash still fails. Current-version replay,
  forged-output detection and malformed-input failures retain their behavior.
  Unit spies prove the current engine is never called for foreign-version
  payloads; database and bilingual admin-fixture checks cover the result.

## Changed files

- Date decision and enforcement: `docs/DECISIONS.md`,
  `docs/THEME_DATE_VALIDATION.md`, `src/lib/format.ts`,
  `scripts/eslint-formatting.mjs`, `tests/date-policy.test.ts`.
- Stock social metadata: `src/stock/metadata.ts`, `tests/stock.test.ts`,
  `tests/stock-browser/server.ts`, `e2e/stock-fixture.spec.ts`.
- Safe browser bootstrap/CI: `tests/stock-browser/environment.ts`,
  `tests/stock-browser/setup.ts`, `tests/stock-browser-setup.test.ts`,
  `playwright.stock.config.ts`, `.github/workflows/ci.yml`.
- Verification: `src/screening/contracts.ts`, `src/screening/verify.ts`,
  `src/components/financial/ScreeningControls.tsx`, `tests/screening.test.ts`,
  `tests/screening.integration.test.ts`,
  `tests/browser-fixture/screening-actions.ts`, `e2e/financial-fixture.spec.ts`,
  `docs/STEP_EIGHT_HANDOFF.md`.
- Pending-copy inventory: `docs/arabic-drafts.json`, `docs/ARABIC_REVIEW.md`,
  `docs/AR_REVIEW_KEYS.md`. Existing row-specific drafts were preserved.
- Reconciliation with completed Home/Stock Search and Arabic approval:
  `e2e/accounts-locales-fixture.spec.ts` targets the theme button rather than
  every header button; `e2e/production.spec.ts` verifies the new search-form and
  methodology-link keyboard stops after the skip link;
  `e2e/hydration.spec.ts` uses the existing approved localized create-button
  label rather than assuming English in Arabic.
- This validation report: `docs/STOCK_VERIFICATION_FOLLOWUPS.md`.

Preview tooling also normalized `.replit` port metadata by removing the legacy
`exposeLocalhost` field; no workflow command or port number changed. Next's
generated development type references were restored by the preview restart.

No dependencies, migration files, screening rules, engine/calculation versions,
stored production runs/hashes, live imports or Supabase data were changed.

## Checks and exact outcomes

All application Next development, copied-production hydration and production
build/server processes were serialized. Database servers were owned disposable
native PostgreSQL 17.5 processes, not Supabase or Replit Database.

| Check | Final result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass, no lint warnings |
| `pnpm lint:logical` | Pass |
| `pnpm test` | 45 files, 918 tests pass |
| `pnpm test:engine` | 6 files, 215 tests pass; statements/branches/functions/lines all 100% |
| `pnpm exec tsx scripts/ar-review.ts --check` | Pass; 298 pending rows, no unresolved coverage surfaces or unused message leaves |
| `pnpm test:db` on a newly initialized PostgreSQL 17 cluster | 7 files, 190 tests pass, including both new stored historical-row cases; empty-database bootstrap ran first |
| `pnpm test:e2e:stock` independently on a fresh default loopback cluster | 11 pass, with no prior database suite, migration run or manual seed |
| `pnpm test:e2e:stock` independently on another fresh cluster at CI port 5432, database `stock_ci` | 11 pass; launched with `env -i`, only PATH/HOME, an explicit disposable TEST URL and the managed Chromium override |
| `pnpm test:e2e --workers=1` with database/provider credentials removed | 11 pass, 2 live-Google redirect cases skip because no provider is configured |
| `pnpm test:e2e:accounts` | 108 pass, including intact/tampered unsupported replay in both locales and the existing current-engine cases |
| `pnpm test:e2e:hydration` | 4 pass, real copied Next production SSR/hydration and theme/date matrix |
| `pnpm build` with database, provider, session and SEC credentials removed | Pass; public routes remain static/ISR and private routes dynamic |
| `pnpm build:jobs` | Pass |
| `playwright.methodology-isr.config.ts`, cold outage phase, credential-free | 7 pass; deliberate missing-database requests fail closed as expected |
| `playwright.production.config.ts`, desktop and Chromium phone-320/phone-390, credential-free with CI behavior | 14 pass, 6 configured database-available cases skip |
| Decision-ID audit, protected approval/reference/message diff checks, `git diff --check` | Pass |
| Stock SSR visual capture at `/en/stock/demo-fixa` | Pass; visibly rendered synthetic example, not a real issuer or approved production screen |

Workspace Chromium invocations used
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium`; CI retains its
versioned browser installation. The independent explicit-target run used
`postgresql://postgres@127.0.0.1:5432/stock_ci`, not an inherited developer URL.

Initial checks exposed three stale browser assumptions (an ambiguous header
button, an English-only Arabic admin selector, and the old post-skip-link focus
order), plus missing pending-copy documentation markers and a setup-environment
literal type. These were corrected; the final results above are the subsequent
passing runs, not the initial failures. A temporary explicit-port test-launch
helper also hit the already-documented tsx CommonJS/top-level-await distinction;
using a native Node port probe allowed the clean-environment run to pass without
changing the database harness.

## Unavailable checks and remaining boundaries

- The matching Playwright WebKit binary downloaded, but its launch preflight
  failed because this workspace lacks its native GTK/GStreamer/other shared
  libraries. WebKit production projects were **not run or claimed passing**.
  The existing GitHub runner still installs these with `--with-deps`. Physical
  Safari/Firefox checks remain separate existing follow-ups.
- The six production checks requiring a database-available production runtime
  were **not run**. Their CI skips were retained; production connection guards
  were not weakened to accept loopback PostgreSQL. The cold-outage suite, public
  role stock suite and copied-app hydration checks are distinct evidence, not a
  claim of live production database verification. The warmed production ISR
  outage phase was likewise not applicable without that successful warm phase.
- Real Google sessions and real admin/editor AAL2 sessions were **not used**.
  Admin results were checked through the isolated action fixture; runtime auth
  guards remain in place.
- The hosted GitHub gitleaks action, artifact upload and Docker image build were
  **not executed in this workspace**. They remain in CI; no container was
  provisioned and no deployment was attempted. Dependency installation was not
  rerun: package metadata and the lockfile are unchanged.
- `pnpm live-check` is documented in the project instructions but has no script
  in the current package manifest; it was **not run**. The available applicable
  production browser/ISR checks are reported above.
- New Arabic-facing verification copy remains pending the existing human-review
  workflow. No new Arabic approval, methodology approval or launch authorization
  is implied.

**Migrations:** none added or edited. Only existing migrations and synthetic
test/demo seeds ran on owned disposable loopback clusters. No Supabase access,
live seed/import, historical-data rewrite or deployment occurred.
