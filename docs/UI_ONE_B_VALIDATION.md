# UI-1B validation — 5 November 2026

## Result

Implemented display-only decision **D-162**. Applied the exact 107-row attachment
through `src/i18n/approved-arabic-ui-one-b.ts`; the independent attachment test
checks every source/pair. `src/i18n/ui-one-b-review-proposals.ts` contains **124**
additional requested runtime proposals, each listed with Arabic in
`docs/UI_ONE_B_REVIEW.md`. They are not claimed as individually pre-approved.

Earlier identical-source approvals retain precedence:

- Unlabelled criterion → **معيار بلا تسمية**, not معيار دون اسم.
- Methodology records → **سجلات المنهجيات**, not سجلات المنهجية.

The complete finite copy-helper/metadata/JSX corpus contains **569 sources**.
The completeness test checks these, the account dictionary, all Arabic JSON
leaves and developer palette descriptors. CIK and Google are explicit existing
regulatory/brand identifiers, not missing translations. The live pending
inventory now contains only **two legal-body rows**, with zero unresolved
surfaces and zero unused message leaves. O-7 remains open.

## Actual checks

The final exact sequence succeeded:

```sh
pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test
```

- Typecheck: passed.
- ESLint: passed.
- Logical-direction lint: passed.
- Unit tests: **112 files, 1,903 tests passed**.
- Existing Vite native-config loader warning remains non-fatal; no tooling or
  configuration was changed to suppress it.
- `pnpm ar-review:list`: two legal review rows; no coverage/draft gaps.
- `git diff --check`: passed.
- Workflow startup clean; all requested development-page requests returned 200.

Playwright:

```sh
UI_ONE_B_ORIGIN="https://$REPLIT_DEV_DOMAIN" \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=<existing Nix Chromium> \
pnpm exec playwright test --config playwright.ui-one-b.config.ts
```

**18 passed**: `/`, `/search?q=a`, `/search?q=zzzz`, `/stock/nyse-ko`,
`/methodology`, `/methodology/al-rajhi-adapted`, `/auth/sign-in`, `/terms`
and `/privacy`, each in Arabic and English. The checks inspect text nodes,
including initially closed evidence content, and accessible/title attributes;
scripts and immutable HTML fingerprints are not misclassified as visible copy.
Both legal articles in both languages render without either review marker.
The phone sign-in screenshot was also visually inspected.

## Protected boundaries and test changes

`docs/UI_ONE_B_REVIEW.md` contains the complete modified/new-test inventory and
the reason for every change. The audit-baseline test changes only the expressly
authorized unknown-summary fallback assertion, adding the requested no-`⟦` and
no-Arabic assertions. Every other assertion in that test remains unchanged.
All engine/reason, baseline fixture, immutable-hash, stored-run, financial,
source, threshold and legal assertions remain intact.

The first full run found one outdated UX-only stock language-notice expectation.
UI-1B now translates the remaining empty-record prose in that fixture, so only
its expected notice count changed to zero. Its complete initially closed
server-rendered immutable-record assertions are unchanged. The final complete
sequence then passed.

No changes to `src/engine/`, `tests/fixtures/`, `content/legal/`, financial
derivation modules, methodology records or migrations. No deployment or live
import was performed. Legal file launch-gate markers remain in their original
files; the existing legal renderer removes them only from presentation.

## Verification limits

Signed-in account, MFA and admin screens were not browser-verified: these require
real sessions. Their finite labels and fallback behavior are covered by source,
registry and unit checks; authentication was never bypassed. Arbitrary stored
prose, provider messages and future errors cannot be enumerated as interface
keys and remain unmarked English when unmapped, with language isolation at
rendering boundaries. Company names, source identities and technical identifiers
were not translated or altered. Local development checks are not claims about
production deployment freshness or legal/methodology approval.
