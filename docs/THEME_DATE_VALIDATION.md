# Theme and date regression verification

## Causes and implementation

- The old raw inline script was created by React on a client-rendering path.
  React warns that such scripts do not execute. A `type` attribute is not a fix.
- The account accepted date used the host's time zone. The same instant could
  therefore produce different server/browser calendar dates. Several other
  formatters hardcoded UTC, and the shared formatter overwrote explicit zones.
- Testing the suggested inline Next `beforeInteractive` replacement exposed
  another distinction: it runs before hydration, but delayed bootstrap allowed
  the first paint to occur before restoration. The final server-only document
  uses the installed App Router/React async external-script resource with
  `blocking="render"`, a stable identifier and private nonce. This is not a raw
  inline executable script. Public documents still read no request APIs.
- D-121 defines calendar dates separately from timestamps. Shared timestamp
  display defaults to Asia/Riyadh and honors explicit market-zone overrides.
  Calendar-only dates retain their original day. Gregorian calendars, Western
  digits, null labels, bidi isolation and each caller's precision are retained.

## Changed files

- Root/theme/CSP: `src/components/foundation/LocaleDocument.tsx`,
  `src/lib/theme-script.ts`, `public/theme-restore.js`, `src/proxy.ts`.
- Shared dates/config: `src/lib/format.ts`, `src/i18n/request.ts`,
  `docs/DECISIONS.md`.
- Display callers: `src/components/accounts/AccountScreen.tsx`,
  `src/components/accounts/AdminScreens.tsx`, and methodology components
  `AdminMethodologies.tsx`, `MethodologyCopy.tsx`, `MethodologyReports.tsx`,
  `MethodologyDirectory.tsx`, `MethodologyDetail.tsx`.
- Enforcement: `eslint.config.mjs`, `scripts/eslint-formatting.mjs`,
  `tests/date-policy.test.ts`, `tests/foundation.test.ts`.
- Browser regression infrastructure: `tests/next-hydration/*`,
  `e2e/hydration.spec.ts`, `playwright.hydration.config.ts`, `package.json`,
  `.github/workflows/ci.yml`, `tsconfig.json`, `playwright.config.ts`.
- Existing test providers/diagnostics: `tests/browser-fixture/app.tsx`,
  `tests/arabic-approval.test.ts`, `e2e/foundation.spec.ts`,
  `e2e/production.spec.ts`.
- Integration lesson: `.agents/memory/structural-merge-conflicts.md`.
- Merged caller-inventory compatibility: `docs/ARABIC_REVIEW.md`,
  `docs/AR_REVIEW_KEYS.md` (regenerated source locations; incoming draft
  proposals and row-specific drafts are preserved unchanged).

No dependencies, migrations, persisted timestamps, auth/MFA policies or screening
calculations were changed. The founder's build reference was not edited.

## Verification

Validated on 2026-10-15, with Next build/development/browser processes serialized:

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass, no warnings; includes formatting guard |
| `pnpm lint:logical` | Pass |
| `pnpm test` | 33 files, 663 tests pass |
| `pnpm build` | Pass; public routes static/ISR, private routes dynamic |
| `pnpm exec playwright test e2e/foundation.spec.ts --workers=1` | 6 real-app development browser tests pass |
| `pnpm exec playwright test --config playwright.production.config.ts --project desktop --grep 'private production scripts\|hydrated theme persists\|keyboard skip link\|actual public/auth/404\|encoded private roots'` | 8 real-app production browser tests pass |
| `pnpm test:e2e:hydration` | 4 production Next matrix tests pass |
| `pnpm exec playwright test --config playwright.accounts.config.ts e2e/accounts-fixture.spec.ts` | 27 component-fixture tests pass; **not** SSR/hydration evidence |

Workspace browser commands use the managed Chromium executable override.

### Validation after synchronizing newer main-project changes

The first completion check synchronized newer Arabic-review/navigation work and
found structurally damaged test sections. Those results invalidated the earlier
passing report. The foundation, Arabic approval and production navigation tests
were reconciled against the intact latest main versions, preserving their
existing assertions and only adding the intended timezone/theme diagnostics.
The entire table above was then rerun against the repaired combined code.

The last documentation-only synchronization added one incoming inventory test.
Typecheck, both linters and all 663 unit tests passed again afterward.
Application source, browser tests and browser/build configuration were unchanged
by that synchronization, so the successful build and 45 browser checks remain
valid for the final application code.

The merged review generator requires byte-identical caller inventories.
Regeneration updates source locations after formatter migration. The latest
incoming main-project documentation supplies all navigation/recovery draft
rows; these were preserved unchanged, without adding translation proposals.
No application translation, approved row, English/Arabic message JSON, legal
policy or runtime copy was changed. D-103–D-106 were already occupied by the
merged terminology decisions. The date policy now uses D-121 to avoid sharing
the Arabic batch-2 approval identifier.

One development browser startup was blocked because the preview had resumed and
held Next's shared development lock. After stopping that workflow, all six
development checks passed. No assertion or diagnostic suppression was added.

The new matrix covers home, methodology, sign-in, account with a synthetic user,
and admin with a synthetic admin in both locales and saved themes. It checks
direct loads, reloads, shared-header/cross-group navigation and locale changes.
The server is UTC; the browser is Los Angeles. The accepted timestamp
`2026-10-11T22:30:00Z` is verified in server HTML and hydrated UI as October 12
in Riyadh. Admin hydration is confirmed by a real client state transition, with
no submission or database mutation.

The fixture builds the current application as a separate standalone Next app,
substituting only module-boundary IO. Workspace database/provider credentials
are stripped. The real application's auth guards remain unchanged. All console
errors, hydration warnings and uncaught page errors fail with route diagnostics.
Private script nonce checks and cookie-independent public ISR checks pass.

Paint assertions compare the actual root class mutation against browser
first-paint/first-contentful-paint entries. Both Next bootstrap and theme-resource
requests are deliberately delayed. Restoration happens once per document and
before paint; the assertions do not infer pre-paint behavior from hydration.

Live Google/TOTP sessions and physical Safari/Firefox checks were not performed.
These results do not claim live-provider verification or full cross-engine
coverage. No production deployment or live database mutation was performed.
