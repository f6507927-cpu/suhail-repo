# UX-7 implementation and dev verification

Date: 2026-11-04.

## Scope and decisions

- Implemented UX-7 only: viewport entrances, ratio growth, public interaction
  feedback, decorative-icon audit, active-theme browser chrome and browser checks.
- Entrances use 20px translation and opacity, 80ms staggering, once per element.
  Ratio fills use scaleX from the appropriate inline-start side. Stored ratios
  and final fill widths are unchanged.
- SSR content is visible without JavaScript. Reduced motion disables CSS motion
  and cancels running Web Animations. Keyboard focus cancels active reveals.
- Public focus rings use Brass Soft. Passive cards do not become fake controls
  or gain unnecessary tab stops.
- Existing decorative icons already had aria-hidden. Badge text and the original
  branding assets were preserved.
- D-22: the original external pre-paint theme restore script is unchanged.
  Browser chrome is synchronised after hydration, immediately on toggles and
  after metadata replacement. This avoids React's duplicate hoisted-meta issue.
- D-40: no additional inline script, request nonce, CSP relaxation, public
  cookie/header read or server personalisation was introduced.
- D-137/D-139: public but unindexed remains the policy. No sitemap was added,
  no SITE_MODE change was made, and nothing was deployed.
- The founder explicitly requested that Supabase stay unchanged. No migrations,
  remote writes, imports or hosted configuration changes were performed.

## Checks

The ordered command was run:

```sh
pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test
```

Result: PASS — 100 unit-test files, 1,695 tests.

Additional browser verification:

- Dedicated populated, disposable PostgreSQL/Next fixture suite:
  `pnpm exec playwright test --config=playwright.motion.config.ts`.
  **PASS — 11 tests.** This is separate from real dev/Supabase verification.
- Its viewport cases cover Arabic and English at 375, 768 and 1440px:
  home, search, stock, methodology directory/detail, Terms and Privacy.
- Other cases cover once-only compositor animations, staggering, RTL/LTR ratio
  origins, reduced motion, no-JavaScript visibility/disclaimer use, Brass Soft
  focus, decorative SVG semantics, and one theme-color tag across theme/locale
  changes.
- `pnpm test:e2e` ran against the existing dev server, without launching the
  default live-mode test server: **FAIL — 8 passed, 15 failed**.
- The failures are not all database failures: they include exact cache-header
  expectations, fixture-only session hooks unavailable in the real app,
  an older disclosure `open`-attribute expectation, unavailable fixture stocks,
  and failed homepage/stock responses. Runtime auth was not bypassed to make
  fixture-only tests pass.
- The new real-dev viewport canaries reject HTTP 500 pages instead of letting
  an error document count as successful responsive verification.
- A 375px screenshot of the real `/styleguide` was inspected; it rendered
  successfully without console errors. It is not evidence that the failed
  homepage or stock page rendered.

## Reference §13.3: actual dev-server results

The reusable diagnostic command is:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium \
  pnpm live-check -- --base "https://$REPLIT_DEV_DOMAIN"
```

It exits nonzero for failed **or unverified** checks. It does not convert
offline tests into live evidence or perform writes to obtain verifier proof.
The machine-readable result is
`generated-artifacts/ux-seven/live-check.json`.

| Row | Check | Result | Evidence / blocker |
| --- | --- | --- | --- |
| 1 | Verdict SSR | FAIL | `/stock/nasdaq-aapl` returns HTTP 500; no successful company/verdict/date response. |
| 2 | Arabic-first | FAIL | Successful stock response unavailable; an Arabic error document is insufficient. |
| 3 | Stock preview metadata | FAIL | Successful stock response unavailable; generic error metadata is insufficient. |
| 4 | Crawlability | PASS | D-139 override: noindex/nofollow on sampled responses, robots disallow-all, no Basic Auth, sitemap 404. |
| 5 | No anonymous internal data | PASS | Profile API 401; internal/list-all probes only 401/403/404. Guarded server actions remain intact. |
| 6 | Branding assets | FAIL | Complete primary-page inspection blocked by home/stock HTTP 500. Assets themselves were not changed. |
| 6a | Palette/type | FAIL | Primary-page computed-style inspection blocked by HTTP 500. |
| 6b | Colour exclusivity | FAIL | Primary-page inspection blocked by HTTP 500; no status palette was changed. |
| 6c | Copy register | FAIL | Primary-page rendered-copy inspection blocked by HTTP 500; no copy approvals were changed. |
| 7 | Old branding | PASS | No old branding found in the served responses and 17 served client chunks. |
| 8 | Security headers | PASS | Actual dev response has HSTS, public CSP and frame denial. |
| 9 | Client secrets | PASS | Existing secret-pattern scanner found no violations in the 17 served client chunks; values were not logged. |
| 10 | Stored-run determinism | FAIL | Not live-verified: no authenticated stored-run replay. Offline engine tests are not a substitute. |
| 11 | AI guardrails/fallback | FAIL | Not live-verified: no controlled live rejection probe; no invalid prose was written. |
| 12 | Console | FAIL | Home and stock HTTP 500; two console/uncaught-error events during the probe. |

The observed database blockers are missing `company.display_name_en` and
`public_settings.featured_security_id`, from earlier UX work. Applying the
already-prepared migrations needs separate authorisation. The database was left
as requested; no fallback was added to conceal this mismatch.

## Files changed

Application:

- `src/app/[locale]/(public)/layout.tsx`
- `src/components/foundation/PublicMotion.tsx`
- `src/components/foundation/PublicMotion.css`
- `src/components/foundation/PublicInteractions.css`
- `src/components/foundation/ThemeColor.tsx`
- `src/components/foundation/ThemeToggle.tsx`
- `src/components/foundation/LocaleDocument.tsx`
- `src/components/foundation/RecoveryDocumentClient.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/stock/StockSummary.tsx`
- `src/components/stock/StockVerdictParts.tsx`
- `src/lib/theme-script.ts`

Verification/documentation:

- `package.json`
- `scripts/live-check.mjs`
- `scripts/live-check.d.mts`
- `tests/public-motion.test.tsx`
- `tests/live-check.test.ts`
- `e2e/motion-fixture.spec.ts`
- `e2e/public-motion.spec.ts`
- `playwright.motion.config.ts`
- `docs/UX_7_VERIFICATION.md`
- `.agents/memory/MEMORY.md`
- `.agents/memory/theme-color-hydration.md`

Migrations: **none**.
