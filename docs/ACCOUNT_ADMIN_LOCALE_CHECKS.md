# Account, administration and MFA locale checks

## Evidence boundary

The English and Arabic checks use the **real client components in the isolated
accounts browser fixture process** (`http://127.0.0.1:3300`). The process bundles
test-only authentication, navigation and action stand-ins. It does not run the
Next application, call Supabase, read/write a database or authenticate a real
user. Synthetic users, methodology options, audit events and setup keys are
fixture data only.

No authorized non-production account or signed-in browser session was supplied.
**Live signed-in Account/Admin/MFA screens were not verified.** These checks
are not evidence of real Google sign-in, provider cookies, TOTP enrollment,
server-side role/AAL2 enforcement or persistence. Production data was not used.
Runtime authentication, MFA, CSP and server guards were not bypassed or weakened.

## Browser coverage (both locales)

- `AccountScreen`: one h1 followed by Profile, Interface language, Policy
  acceptance and Delete account h2s; exact D-96 Arabic labels; real label
  associations; keyboard preference selection/save; localized language-change
  destination; policy-link URLs; literal `DELETE` confirmation and disabled
  deletion for other values; fixture deletion error; admin/editor deletion
  controls absent.
- `UsersAdminScreen`: search label and submit destination, paging and empty
  state; role-dialog h2 and accessible name; role and required reason labels;
  localized role options; disabled confirmation without a reason; keyboard
  change submission; error then successful fixture action; focus on opening,
  Tab/Shift+Tab containment, Escape, Cancel, Close and restored trigger focus.
- `AuditAdminScreen`: h1, Event type/Entity/From/To label associations, filter
  query destination, next-page filter preservation, keyboard details
  expand/collapse, entity/event IDs and approved empty-state text.
- `SettingsAdminScreen`: h1, exact approved field names, separately associated
  help descriptions, default option, keyboard select/checkbox/save, fixture
  success/error feedback and submitted arguments.
- `AdminShell`/`DeferredAdminSection`: named navigation, current Users link,
  localized navigation and deferred h1/h2, admin-only navigation absent for an
  editor fixture. This is UI evidence, not a permissions test.
- `MfaScreens`: enrollment and verification h1s; enrollment scan h2, localized
  QR alternative and copy-key button name; associated exact code labels;
  LTR setup key/code, numeric input mode and one-time-code autocomplete;
  keyboard setup and submission; disabled short-code submit; rejected fixture
  code and successful fixture code destination. A fake AAL2 response is
  confined to the test process.

Unlisted Arabic help, error and status text retains `⟦AR-REVIEW⟧`, including
settings descriptions and failure feedback. No new wording was approved.
Legal-document bodies and disclaimers remain outside D-96 approval and retain
their existing review requirements; this check does not approve those texts.

## Fixes exposed by the checks

1. The role-change modal previously left focus on the background trigger.
   A native modal dialog now makes the background inert, moves focus inside,
   handles Escape and restores the trigger. Explicit boundary wrapping keeps
   Tab/Shift+Tab inside its enabled form controls.
2. Settings help previously became part of the field's accessible name.
   Exact approved labels now use explicit label associations, with help supplied
   separately through `aria-describedby`. Help review markers are preserved.
3. The older embedded Arabic sign-in fixture still searched for English button
   and link names. Its assertions now use the approved D-96 names; it continues
   to assert that no OAuth request starts inside the iframe.

## Reproduce

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v chromium)" pnpm test:e2e:accounts
pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test
```

Use an installed Playwright browser instead of the executable override where
available. Outputs are ignored under `generated-artifacts/`.
The fixture configuration owns its separate server, not the Next development
server; it can run without stopping the preview workflow.

The suite contains 21 browser checks (14 new bilingual screen checks and
7 existing account/auth-boundary checks). Live signed-in verification requires
a separately authorized non-production account; do not reuse production
credentials or introduce a runtime test route/flag to obtain it.

## Recorded result — 12 October 2026

- All 21 fixture browser checks passed in Chromium.
- Typecheck, ESLint and logical-direction lint passed.
- All 526 unit tests across 23 files passed.
- The preview workflow restarted successfully. An anonymous `/account`
  screenshot followed the expected redirect to Arabic sign-in and showed no
  browser errors. This screenshot is **not** signed-in UI evidence.
- No dependencies or migrations were added.

## Public-page scope change — 13 October 2026

The founder subsequently requested work on non-login pages and specifically
asked to fix the broken Methodologies link rather than hide it. Live signed-in
verification remains deferred and is not claimed by this change.

The existing header link now opens `/methodology` (Arabic) or `/en/methodology`
(English), with the existing public shell and the exact D-96 approved text
“This section is not available yet.” This is an explicit unavailable section,
not a fabricated methodology list or a claim that a database query found no
published versions. The full methodology directory is not implemented by this
link repair.

Production browser regressions cover keyboard link activation, locale and
direction, the heading and unavailable notice, same-path locale switching,
HTTP 200, cookie-free ISR and no anonymous private-profile requests.
After preserving the incoming public desktop and phone regressions, the
production build, all 13 production browser checks, typecheck, both lint
checks and all 529 unit tests passed. The Arabic destination was visually
checked at a phone width; the proxied English destination returned HTTP 200.
