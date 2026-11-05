# UI-1 display-only implementation and verification

Decision: **D-157**, founder approval dated **5 November 2026**.

## Scope and preserved boundaries

All 26 supplied bilingual rows are recorded independently in
`src/i18n/approved-arabic-ui-one.ts`. Public rendering maps copies of known
stored values; unknown values keep their existing fallback. Structured numerator
wording is selected by reason code. The existing localized short disclaimer is
used without changing either dictionary value or legal body.

No engine template, engine test, historical Arabic approval baseline, hash
snapshot, immutable payload, database/schema, migration, source, threshold,
financial value, methodology record, stored run or workflow state was changed.
O-7 remains open. No Supabase operation, live import, hosted setting change,
deployment or republishing was performed. No dependencies were added.

## Changed implementation and approval files

- `docs/DECISIONS.md`: new display-only D-157, including historical-pin retention,
  wording precedence and the explicit UX-5 item 4 supersession.
- `src/i18n/approved-arabic-ui-one.ts`: exact approved table and shared mapping.
- `src/stock/presentation.ts`: structured-reason presentation and render-only
  zero-count suppression/meaningful deduplication.
- `src/components/stock/StockVerdictParts.tsx`: shared stock labels, RTL/language
  isolation, boolean record presentation and narrative eligibility helpers.
- `src/components/stock/stock-language-notice.ts`: inspect the narrative actually
  rendered, excluding company, ticker, exchange and source-title identities.
- `src/components/stock/StockSummary.tsx`: mapped reasons, criterion wording,
  boolean result/explanation, missing figures and supplied draft presentation.
- `src/components/stock/StockVerdict.tsx`: full-record wording, localized short
  disclaimer, supplied draft presentation and one conditional language notice.
- `src/components/foundation/EngineStatement.tsx`: display override while retaining
  the old dictionary key/value and historical approval pins.
- `src/components/stock/StoredMonthlyClose.tsx` and
  `src/components/stock/ApiNinjasAttribution.tsx`: localized approved close/provider labels.
- `src/components/home/HomePage.tsx`: same criterion/reason mapping; no numeric
  activity value or boolean ratio bar.
- `src/components/search/SearchResults.tsx`: remove the language notice.
- `src/components/methodology/MethodologyDirectory.tsx`,
  `MethodologyDetail.tsx`, and `PublicMethodologyVersions.tsx`: apply the same
  display map to public methodology names, scope, publisher, verifier, version
  labels, selector options and applicable criterion text; preserve stored
  IDs, version selectors, source identities and explicit workflow evidence.
- `src/stock/metadata.ts`: mapped descriptions/social metadata; version-free
  titles, unchanged canonical/indexing/company-name behavior.
- `scripts/ar-review.ts`: recognize the narrowly approved close-label display
  override without rewriting its historical dictionary value.
- `docs/ARABIC_REVIEW.md`, `docs/AR_REVIEW_KEYS.md`, `docs/arabic-drafts.json`:
  regenerate pending-only inventories; remove the approved close-label row and
  retired no-run wording from pending drafts. Other approvals remain unchanged.
- `.agents/memory/MEMORY.md` and `browser-test-executables.md`: retain the
  environment lesson that a missing Playwright cache need not mean no installed browser.

## Every modified existing test file and reason

| File | Authorized assertion changes |
| --- | --- |
| `tests/stock-ux-five.test.tsx` | In `keeps the entire immutable record in closed server HTML in ar/en`, expect the locale's existing short disclaimer rather than English in both locales. Preserve the closed server-rendered details, full hash, fundamentals, disclaimer section, identity, search-again and immutable-object assertions. |
| `src/components/stock/StockVerdict.cleanup.test.ts` | Update only notice expectations: translated short context does not force a notice; identities, short labels, source titles and hidden content do not trigger it; actually rendered English sentences still trigger one header notice. Preserve money/evidence, immutable fixture, marker suppression and hidden-content assertions. |
| `tests/stock.test.ts` | The no-run title uses the supplied new no-run wording in each locale. Preserve indexing, canonical/social metadata, curated/SEC name fallbacks, failed-read and immutable fixture assertions. |
| `tests/stored-close.test.tsx` | Expect approved localized attribution and closing-date label; remove the obsolete assertion that Arabic copy must be marked as English. Preserve provider link, date, Western digits, numeric isolation and missing/manual evidence tests. |
| `tests/public-ux-copy.test.tsx` | Search identities never cause a language notice in either locale. Preserve identifiers and row-content assertions. |
| `e2e/stock-fixture.spec.ts` | Tiny boolean criterion shows its result, not a numeric `> 0` value or ratio image. Preserve the separate financial-precision, optional-label and overflow checks. This legacy database-backed browser suite was not run here. |

No protected assertion was edited.

## New tests and local fixture infrastructure

- `tests/ui-one-display.test.tsx`: all 26 pairs independently checked against the
  attachment; both locales and every status/no-run; closed/full record text;
  visible-code checks excluding scripts/attributes; code-selected numerator
  wording; counts; deduplication preserving distinct criteria/inputs; immutable
  data; boolean/missing-figure presentation; draft/title/social formatting;
  home consistency; separate company/ticker/exchange/source/sentence/paragraph
  notice cases; unknown fallbacks; search notice absence; Arabic bidi isolation.
- `tests/fixtures/ui-one-stock.ts`: deterministic synthetic stock and reason shapes.
- `tests/ui-one-methodology.test.tsx` and
  `tests/fixtures/ui-one-methodology.ts`: both locales' public directory/detail,
  verifier and version selector; stock deep-link target; unmapped verifier and
  explicit workflow evidence; complete input preservation.
- `tests/ui-one-browser/render.tsx`, `server.ts`,
  `navigation.tsx`, `playwright.ui-one.config.ts`, `e2e/ui-one.spec.ts`: database-free browser checks
  at 390px/1366px in both locales, every status/no-run, native disclosure opening,
  visible full-record text, home card, search, stock-to-methodology navigation
  and directory-to-detail navigation.

## Actual results

Final required sequence, in order:

1. `pnpm typecheck` — passed.
2. `pnpm lint` — passed.
3. `pnpm lint:logical` — passed; no physical-direction classes/properties.
4. `pnpm test` — **106 files, 1,786 tests passed**.

Additional checks:

- `pnpm ar-review:list` — 169 pending rows; zero unresolved coverage surfaces;
  zero unused message leaves. Its unchanged audit tests pass.
- `pnpm exec playwright test --config playwright.ui-one.config.ts` with the
  installed Chromium executable override — **4 passed**, covering 20 stock-state
  visits plus home/search, directory/detail and stock-to-methodology navigation
  at phone and desktop widths.
- Local Arabic stock fixture visually inspected. Application workflow restarted
  and startup confirmed ready. `git diff --check` passed.
- Earlier checks exposed and fixed a fixture property-type error, obsolete
  UX-only assertions, a dictionary-caller audit issue and local fixture-server
  module/browser-path setup. No protected pin was changed to fix them.

## Unmapped values and verification limitations

**Unmapped supplied table rows: none.** No company-name translations were supplied
or invented.

Unknown future values remain visible through their existing fallbacks, including
the explicit regression values `future_stored_value`, `Distinct unmapped criterion`
and `Unrelated version`. Existing free-text evidence such as `Data freshness` and
`Configured average asset denominator` remains distinct, not replaced with a
generic missing-input label. Existing synthetic labels/prose outside the table
remain unchanged: `Debt`, `Method`, `Stored method`, `Revenue screen`,
`Initial reviewed edition`, `Revenue ratio`, `Annual prohibited income`,
`Annual revenue and asset screening.`, `Total revenue divided by total assets.`,
`No annual filing was found.`, `The result needs review.`,
`Revenue was not reported.`, `Revenue increased during the year.`,
`No annual filing.`, `Future narrative`, and `English scope`.
The methodology regression's `Unmapped verifier` remains unchanged as well.
These are retained fallbacks, not additional approved translations.

Company/ticker/exchange/source identities are intentionally not translated and
do not qualify for the English-only notice.

No hosted stored-row inventory was queried, so this is not an exhaustive list
of prose in the hosted database and not a claim about deployment freshness.
Verification used local deterministic fixtures; the complete existing
database-backed/Next end-to-end suites, production build, signed-in UI, physical
iPhone Safari and Firefox were not exercised. Existing engine/hash/historical
approval tests were run unchanged as part of `pnpm test`.
