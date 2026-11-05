# UI-2: stock dates, monetary evidence and ratio context

## Changes and boundaries

Founder-requested presentation changes are recorded in **D-161**, applying D-21's
Gregorian/Western-digit convention and preserving D-04's no-live-price boundary.
No stored financial facts, prices, runs, statuses, thresholds, source records,
engine output, hashes or methodology records were changed. No migrations,
Supabase writes, imports, hosted settings or deployment were performed.

- `src/components/stock/StockDate.tsx`: one date presentation for Arabic/English
  stock text, using body-font prose, explicit RTL/LTR, and isolated digit runs.
- `src/components/stock/StockSummary.tsx`: use that date in the summary/four figure
  cards, name both stored ratio operands, retain missing-figure wording, and show
  the stored closing price as one quiet fifth line. Card fact selection is unchanged.
- `src/components/stock/StockVerdict.tsx`: date formatting for filing/source dates,
  prior runs and metadata; full-dollar fundamentals caption and removal of the
  repeated USD/absolute-unit column. Remove the old buried closing-price rendering.
- `src/components/stock/FundamentalValue.tsx`: presentation-only scaling of
  declared units, `$`-prefixed full dollar amounts, preserved non-USD/count,
  missing, zero, negative and unknown-scale fallbacks.
- `src/components/stock/StoredMonthlyClose.tsx`: `$344.63`-style USD output,
  long localized calendar date, provider attribution and available stored manual
  source links. No quote request, refresh, timestamp invention or direction color.
- The close presentation uses the existing optional `source_url` when available;
  its type and the public query already supply it, without any query change.
- `src/components/stock/StockVerdict.module.css`: body-font dates, quiet spanning
  closing-price row and fundamentals caption styling.
- `src/lib/format.ts`: full-dollar display helper and extraction of the existing
  explicit scale multiplier used by the cards; no change to date/time-zone rules.
- `src/i18n/approved-arabic-ui-two.ts`: caption wording for the requested presentation.
- `docs/DECISIONS.md`: D-161 (D-158/D-159 were reserved by concurrent main-project
  wording/presentation decisions, retained unchanged).
- During synchronization with newer main-project work, retain the broader
  governed-label fallbacks in `src/i18n/stock-labels.ts`, giving D-157's exact
  approved pairs precedence. Preserve activity source-period/SIC provenance
  notes and the newer home-page editorial visibility condition.

## Tests and verification

- New `tests/ui-two-display.test.tsx` and `tests/fixtures/ui-two-stock.ts`: pin
  `31 ديسمبر 2025`, Saudi-time prior-run date `4 نوفمبر 2026`, all four card dates,
  the fifth-line stored close/date/source, caption and full-dollar values,
  exact named ratio operands, missing numerators with multiple denominators,
  card/basis distinction, zero/non-USD/count behavior and input preservation.
- Modified `tests/stored-close.test.tsx`: replace obsolete short-month/whole-date
  bidi markup assertions with the long date and digit-only isolation; pin `$`
  without `US$`; retain provider/missing/manual checks and add safe source URLs.
- Modified the newly received `tests/stock-locale-review.test.tsx`: its three
  English label assertions now expect D-157's approved display wording rather
  than the raw stored key. All reason-template, legal, provenance and arbitrary
  evidence-label assertions are retained.
- New `e2e/ui-two.spec.ts`: phone layouts in both locales, actual RTL date
  direction/body font/day-before-year geometry, ratio note, quiet stored-close
  position outside closed details, source link, caption and no overflow.
- `tests/ui-one-browser/render.tsx` and `playwright.ui-one.config.ts`: add the
  isolated UI-2 fixture/browser checks without any database or runtime auth bypass.

Required checks were run in order:

1. `pnpm typecheck` — passed.
2. `pnpm lint` — passed.
3. `pnpm lint:logical` — passed.
4. `pnpm test` — 110 files, **1,880 tests passed** after synchronization with main.

Additional browser checks: **6 passed** (the existing four bilingual UI-1
phone/desktop checks and two new UI-2 phone checks). Arabic review generation
reports 169 pending rows, zero unresolved coverage surfaces and zero unused
message leaves. `git diff --check` passed. The development workflow started
cleanly. A full-page Arabic 390px phone screenshot is saved at
`generated-artifacts/ui-two-phone.jpg`.

## Where the two market values come from

**Card:** `StockSummary.tsx` → `FactFigure` selects the first
`data.facts` row whose `line_item` is exactly `market_cap`. It displays that
fact's value with its explicit scale and currency. It never reads a criterion
denominator or substitutes `market_value_basis`.

`src/db/stock-public.ts` populates these facts from current company facts for the
selected run's annual financial period, restricted to shared facts or the current
security. A missing row, null value, unknown scale or absent currency yields the
card's `—`. The manual-price path in `src/lib/financial/service.ts` can write
`market_cap` as sourced shares outstanding × one manually entered close; the SEC
mapping report explicitly excludes market capitalization and prices.

**Ratio denominator:** the public criterion row's stored `denominator_value`,
not the card. Where the configured denominator is `market_value_basis`,
`src/lib/financial/market-value.ts` derives it from the three attested month-end
closes of a completed quarter × sourced shares, averages the three market
values, then uses the greater of that average and positive sourced total equity.
Nonpositive equity does not floor the average. Missing required evidence leaves
the basis unknown. An allowed previous-completed-quarter fallback is marked stale.
`market-value-persistence.ts` stores the chosen basis as its own security-scoped
`financial_fact`; the screening run freezes its selected denominator separately.

Thus JPM's reported `$879B` card and `$919B` denominator need not represent the
same calculation or observation date. Apple's empty card does **not** mean its
`$4.64T` basis is missing: the card has no renderable `market_cap` fact for the
displayed period, and it deliberately does not fall back to that separate basis.
This task did not query hosted JPM/Apple rows, so it does not distinguish a missing
Apple fact from a null/otherwise-unrenderable one or establish the exact lineage
of those particular hosted values. The card's selector and all derivation logic
are unchanged for the founder's later decision.

## Verification limits

The screenshot and browser checks use explicitly synthetic local fixtures, not
hosted JPM/Apple records or current market quotes. No production build, physical
iPhone Safari, Firefox, signed-in UI or full database-backed end-to-end suite
was exercised. Historical engine/hash/legal approval tests ran unchanged within
the unit suite. No packages were added.
