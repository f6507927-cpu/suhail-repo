# UI-6 public visual consistency — 5 November 2026

Decision: **D-165**. Display-only; no deployment or production-setting change.

## Implemented

- Shared public radius tokens: cards 20px, pills 999px, small controls 12px. Legacy `--radius: 0.5rem` remains unchanged.
- Theme-aware `--raise`: mockup dark raised surface, existing light card surface. Public cards use background separation; card frames are transparent while status borders, table dividers and keyboard focus cues remain.
- Public methodology directory entries are individual padded, rounded raised cards.
- Sign-in has one centred rounded card: title, existing sentence, Google button, unchanged consent text and links. Removed serial, corner labels and double frame. OAuth, consent recording, errors, retries and `next` remain unchanged.
- Public localized 404 uses the shared GET search form. Standalone 404 uses a provider-independent native equivalent and retains both localized home choices before hydration. Existing private recovery and error behavior is preserved.
- New 404 navigation pair: `العودة إلى الصفحة الرئيسية` / `Back to the homepage`.
- Public and sign-in header language links have 44px minimum tap height. The header is shared with admin, so its new sizing and menu shape explicitly opt in only under the public wrapper or the sign-in marker.
- Restored the mockup's large Arabic footer wordmark. Commit `0884385` removed the wordmark markup/CSS and added two cosmetic absence assertions; no recorded decision prohibits it. Legal and disclosure content/behavior remain unchanged.
- Removed `data-ux-card` from the three non-clickable outcome articles and removed passive card hover/active background painting. Remaining markers (featured card, published pick, boolean criterion, financial criterion) own radius and padding. Actual rendered markers were checked at all three widths.

## Changed files

Public styling:

- `src/app/globals.css`
- `src/components/foundation/PublicInteractions.css`
- `src/components/foundation/SiteHeader.module.css`
- `src/components/foundation/SiteFooter.module.css`
- `src/components/home/HomePage.module.css`
- `src/components/stock/StockVerdict.module.css`

Markup and public-only opt-ins:

- `src/components/foundation/SiteFooter.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/methodology/MethodologyDirectory.tsx`
- `src/components/accounts/AuthScreens.tsx` — sign-in presentation only
- `src/app/[locale]/(private)/auth/sign-in/page.tsx` — scoped public stylesheet import
- `src/components/foundation/RecoveryScreen.tsx`
- `src/components/foundation/RecoveryDocumentClient.tsx`
- `src/app/[locale]/(public)/not-found.tsx`
- `src/i18n/messages/ar.json`
- `src/i18n/messages/en.json`

Tests and documentation:

- `tests/home-ux-six.test.tsx`
- `tests/ui-six-public.test.tsx`
- `e2e/ui-six.spec.ts`
- `playwright.ui-six.config.ts`
- `docs/DECISIONS.md`
- `docs/UI_SIX_VALIDATION.md`

## Test-change inventory

Only existing assertions changed: the two wordmark-absence assertions in `tests/home-ux-six.test.tsx` now require the restored markup and CSS. All its existing legal/disclosure assertions remain.

New `tests/ui-six-public.test.tsx`: nine cases covering both locales' passive outcome articles, footer wordmark/legal preservation, sign-in structure/Google/consent/next/error handling, public versus private 404, search/home routes and private-radius/scoped-style preservation.

New `e2e/ui-six.spec.ts`: five cases covering the five actual development pages at 375, 768 and 1440px; remaining card padding/radius; outcome hover behavior; 44px public language links; sign-in; three functional localized/standalone 404 searches; light-layout checks and private-style sentinels outside the public wrapper.

The initial browser-only legacy-radius assertion compared `.5rem` with `0.5rem`. It now compares their numeric value, without changing the legacy radius. Final checks pass.

No engine, baseline, hash, legal, data, admin or MFA test was edited.

## UI-6 checks before syncing with main

Executed in order:

1. `pnpm typecheck` — passed.
2. `pnpm lint` — passed.
3. `pnpm lint:logical` — passed.
4. `pnpm test` — **115 files / 1,943 tests passed**.

Additional checks:

- UI-6 Playwright against the running development preview: **5 passed**, including all 15 requested route/width combinations with `scrollWidth === innerWidth`.
- Existing UI-1–UI-5 Playwright suite: **15 passed**, including real development Apple/JPM/KO checks.
- `pnpm ar-review:list`: 2 existing pending legal rows, 0 unresolved coverage surfaces, 0 unused message leaves.
- `git diff --check`: passed.
- Visual screenshot inspection: actual public methodology phone page; saved reduced-motion captures of all five requested routes.

Existing non-fatal Vite configuration-loader warning remains.

## Sync with main

The shared memory-index conflict was resolved by retaining both independent notes.
Main also added five dependency-security tests, bringing the combined suite to
116 files / 1,948 tests. The first completion validation passed engine coverage,
typecheck and both lint commands, but failed the new constrained-array security
test: the committed manifest required Zod 4.6.7 while this workspace still had
4.3.3 installed. `pnpm install --frozen-lockfile` synchronized the installed
dependencies without changing the committed manifest or lockfile. All five
dependency-security tests then passed unchanged. Completion validation is rerun
against this combined state; the UI-6-only counts above describe the earlier run.

## Phone screenshots

All 375 × 812, captured from the running development app:

| Route | File |
| --- | --- |
| `/` | `generated-artifacts/ui-six/0-375.jpg` |
| `/search?q=a` | `generated-artifacts/ui-six/1-375.jpg` |
| `/stock/nyse-ko` | `generated-artifacts/ui-six/2-375.jpg` |
| `/methodology` | `generated-artifacts/ui-six/3-375.jpg` |
| `/auth/sign-in` | `generated-artifacts/ui-six/4-375.jpg` |

Tablet and desktop captures are in the same ignored generated-output directory.

## Boundaries

These are development-preview checks, not production freshness or deployment claims. No login was performed and no real Google redirect was started. Light styling was exercised by changing the document theme class; physical-device theme persistence is not claimed. Private/admin preservation was checked through scoped selectors, legacy-radius and shared-header sentinels, unchanged private source, and the existing tests—not through an authenticated admin browser session. No database write, migration, import, financial/status/methodology-record change, legal text edit or deployment was performed.
