# UI-4 — search presentation validation

Decision **D-163**, 5 November 2026. Display-only implementation.

## Delivered

- One native whole-row link per result, including not-screened stocks; 56px
  minimum height, no name underline, and row hover/keyboard-focus treatment.
- Arabic/curated display name first, muted English name/ticker/exchange below,
  existing status at the inline end. No phone multi-column grid. Curated English
  names and existing SEC fallbacks are preserved without new translations.
- Not-screened is plain muted text, not a bordered or input-like badge.
- Shared search form now has the homepage's light pill and Brass button styling;
  the results page and stock search-again inherit it. GET/query/locale/length,
  submission guard, loading and back-navigation behavior are unchanged.
- Smaller, muted results-page heading.
- No Try text, empty ticker list or suggestion aria-label when no suggestions
  exist. A separate ICU coverage summary avoids changing earlier approved
  coverage wording used when suggestions are available.
- Returned result count above the list, using locale ICU plurals and explicitly
  formatted Western digits. This is the returned-list count, not a new total
  matching-record query.

## Checks

Final sequence passed in the requested order:

```sh
pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test
```

**113 files / 1,923 tests passed.** Existing non-fatal Vite native-loader warning
remains unchanged. Arabic review generation: two legal rows, zero unresolved
surfaces, zero unused leaves. `git diff --check` passed.

Playwright: **13 passed**, comprising four new UI-4 cases (Arabic/English at
375px/1440px) plus all nine existing UI-1/2/3 checks, including the actual
Apple/JPM/KO development-page checks. UI-4 verifies link count, whole-row click
away from the name, minimum dimensions, no nested anchors/name underline,
keyboard focus treatment, plain unscreened labels, pill shape, no horizontal
overflow and complete prompt omission with no suggestions.

Actual development `/search?q=a` returned 200 and 10 results at both screenshot
widths. Document width equalled viewport width (375 and 1440). The stock
search-again form was inspected on `/stock/nyse-ko` at 375px. Phone results were
also checked with the app screenshot tool. Screenshots are in
`generated-artifacts/ui-four/`.

## Test inventory

- New `tests/ui-four-search.test.tsx`: 20 bilingual row/form/empty-suggestion and
  Arabic plural cases, immutable fixture preservation, Western digits and both
  present/absent suggestion branches.
- New `tests/fixtures/ui-four-search.ts`: deterministic UI records for all four
  statuses and no-run, distinct source/display names and optional Arabic names;
  no hosted writes or new real-company translations.
- New `e2e/ui-four.spec.ts`: four browser cases as described above.
- `tests/search.test.tsx`: only the old unscreened-nonlink expectation changes
  to require exactly one locale-correct stock link. All query, SQL, privacy,
  source-name fallback, badge, numeric and outage checks remain.
- `src/components/search/search-results-layout.test.ts`: replaces the superseded
  four-column/boxed-unscreened style expectations with whole-row flex target,
  plain status and focus/hover expectations. Existing status-role and
  no-forced-insufficient-status assertions remain.
- `e2e/ui-one.spec.ts`: English fallback now intentionally appears in both name
  lines. The selector asserts exactly two copies and checks the first is
  visible instead of failing strict uniqueness. All full-record/engine evidence
  and navigation assertions remain.
- `tests/ui-one-browser/render.tsx` and `playwright.ui-one.config.ts`: register
  the isolated populated/zero-suggestion UI-4 fixture and browser cases.

The existing exact ticker markup was retained to preserve the independently
pinned Arabic-follow-up test unchanged.

## Source changes and boundaries

Changed UI files: `SearchResults.tsx`, shared `StockSearchForm.tsx`, the public
search route's heading, and two new keys in each locale dictionary. Added the
bounded decision above; existing approved keys are not rewritten.

No changes to backend queries, coverage selection, status logic, financial
values, sources, thresholds, stored runs, immutable hashes, engine/reasons,
methodology records, legal text, auth or dependencies. No migration, live import
or deployment. Empty-suggestion behavior is verified with deterministic fixtures;
the screenshots show actual development data, not invented populated records.
