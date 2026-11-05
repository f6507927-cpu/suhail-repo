# UI-3 — public stock layout verification

## Scope

D-160 records the founder's 5 November 2026 display/layout request. No financial
selection, calculation, source, status, stored record, hash, engine, disclaimer
or database behavior changed. The previously reported capitalization issue and
older duplicate D-157 references are not modified by this layout-only work.

## Source changes

- `StockVerdict.tsx`: quiet identity line with the exchange once and SEC label
  in the sector title; short unboxed intro; remove the pre-answer back-link
  stack; move sharing below the verdict and omit it without a run.
- `StockSummary.tsx`: omit the empty passing summary fallback, render unknowns
  only when present, three metadata rows, confidence explanation with confidence,
  short known methodology display link with the full title retained, and no
  empty criteria/figures/close for the not-screened state. Its accessible section
  name refers to a heading that exists in both run and no-run states.
- `StockVerdict.module.css`: responsive single-line identity, unboxed narrative,
  no side-border accents, metadata wrapping, quiet share styling, pass-result
  green and viewport containment. Financial numbers still use numeric type;
  human-readable long version titles wrap rather than widening an RTL page.
- `StockShare.tsx`: icon-accompanied text actions; canonical destinations,
  native share/clipboard behavior and polite result announcements are preserved.

Full-record disclosure remains initially closed and server rendered. Screening,
known/unknown evidence, methodology, criteria, fundamentals, sources, history,
metadata and disclaimer remain in that record when the run exists. The no-run
message, full-record disclosure/disclaimer and search-again remain available.

## Tests added or modified

- **New** `tests/fixtures/ui-three-stock.ts`: deterministic synthetic cases for
  all four statuses plus not-screened; includes a long unmapped draft version
  title and financial facts even in the no-run fixture, so hiding empty-summary
  elements is tested independently of absent data. Not a copy of hosted rows.
- **New** `tests/ui-three-layout.test.tsx`: 12 bilingual cases verify record
  preservation, immutable inputs, exchange once, SEC label not visible, share
  order, no-run omission, passing fallback/empty unknown omission and three
  metadata rows.
- **New** `e2e/ui-three.spec.ts`: two tests traverse all five cases at 375×812,
  checking badge and first reason within the screen, no asymmetric side borders,
  unboxed header children, no horizontal overflow, pass bars, over-limit markers,
  and absent no-run figures/sharing. A third, explicitly opted-in, read-only
  test checks actual Apple/JPM/KO public pages at 375px and 1440px.
- `tests/ui-one-browser/render.tsx`: adds the UI-3 fixture and canonical share URL.
- `playwright.ui-one.config.ts`: includes the UI-3 browser cases alongside UI-1/2.
- Completion-time synchronization retained main's named language-notice sections,
  known impact/severity labels, and non-supplied version-label normalization,
  including the complete upper-bound-assumption qualifier. The explicitly supplied
  UI-1 `Adapted research 1.0 — draft` bilingual pair still has display precedence;
  no stored labels or workflow states change.
- `StockVerdict.cleanup.test.ts`: reconciled main's added UX tests with the
  founder's UI-1 exception. Notice cases distinguish narrative from company,
  exchange, source titles, credentials and short labels; the named-section example
  now uses a whole sentence rather than a two-word title. The supplied 1.0 draft
  assertion uses its exact approved Arabic pair, while the non-supplied 1.1 case
  retains main's normalization, qualifier and approval badge. Input-preservation,
  source, numerical, custom-label and genuine-draft assertions remain.
- `tests/stock-ux-five.test.tsx`: keeps the locale-specific short-disclaimer
  expectations and every complete initially closed server-record assertion.
- `tests/stock-unknown-fields.test.tsx`: changes only the Arabic notice expectation
  for short free-text evidence names. All real-engine field projections, distinct
  missing-input names, fallback markup and immutable-hash assertions remain intact.
- The main version-label helper is composed after the exact UI-1 map in stock
  metadata and methodology detail/directory/selector consumers so neither layer
  silently erases the other's applicable display wording.

## Verification

Run in the required order: `pnpm typecheck && pnpm lint && pnpm lint:logical &&
pnpm test`. Final results: all pass, **111 files / 1,899 unit tests**.

Browser command:

```
UI_THREE_PUBLIC_ORIGIN="https://$REPLIT_DEV_DOMAIN" \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=<existing Nix Chromium executable> \
pnpm exec playwright test --config playwright.ui-one.config.ts
```

**9 passed**: four UI-1, two UI-2, two UI-3 bilingual status traversals, and one
UI-3 real-preview traversal covering six stock/viewport combinations. Without
the explicitly supplied public origin the real-preview test is intentionally
skipped; fixture checks still run.

An initial typecheck overlapped Next startup and encountered transient missing
generated route-type files. It passed after startup completed without changing
the TypeScript configuration. Initial screenshots also exposed a long stored
version-label overflow and a more-specific legacy chip-border rule not
represented by the original short fixture. Both are fixed and covered by the
long-label and actual-preview regressions above.

Screenshots: `generated-artifacts/ui-three/{apple,jpm,ko}-{375,1440}.jpg`.
They capture actual read-only public development pages, not synthetic company
fixtures, at 375×812 and 1440×1000. Reduced-motion preference is used for the
saved comparisons so entrance animations do not obscure text at capture time.
They are local development verification, not evidence of a production deployment.

No Supabase write, live import, hosted setting change, dependency change,
migration or deployment was performed.
