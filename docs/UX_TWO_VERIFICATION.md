# UX-2 — numbers and curated English company names

## Changes

- Extended the existing `src/lib/format.ts`, without a second helper file:
  compact USD summaries use `en-US` notation and at most three significant
  figures. The requested examples resolve to `$4.66T`, `$416B`, `$98.7B`,
  and `—` for null.
- Stock summary monetary numerators/denominators use compact dollars. Detailed
  criteria, facts and structured numeric evidence stay unabridged with no more
  than two decimals. Stored data and calculation precision are not changed.
- Percentage ratios and thresholds show two decimal places with `%`. Near a
  failed boundary, truthful `>` / `<` bounds retain the existing distinction
  between a failed result and an apparently equal threshold without exceeding
  two decimal places.
- Financial output continues to use the existing `<Num>` component:
  `<bdi dir="ltr">`, IBM Plex Mono, Western digits and tabular lining figures.
- Added nullable `company.display_name_en`. The admin company-profile tab on
  the securities page edits it through the existing admin-only transaction,
  auditing the previous and next value. Input is trimmed, bounded to 1,000
  characters, and clears to SQL null. Editors remain read-only.
- Company display surfaces prefer the curated English name, then the SEC name:
  public stock identity, English identity beside the Arabic name, Arabic
  fallback, search results, title/social metadata and admin company headings.
  Search also matches both the curated name and original SEC name.
- The stored SEC name remains read-only in the admin source field. SEC lookup,
  stored screening identity, replay/hash evidence and source exports retain the
  original issuer identity. The admin run header receives its current display
  name separately, without rewriting the immutable run.
- Applied D-21, D-30 and D-148, plus reference §4.3. UX-2's requested fixed
  precision preserves the truthful-boundary intent of D-138. No engine rule,
  status, approval state, legal copy or later UX step changed.

## Migration

**`drizzle/0015_company_display_name_en.sql`** (renumbered after the main-project
analyst-case migration took `0014`; SQL contents unchanged)

```sql
ALTER TABLE "app"."company" ADD COLUMN "display_name_en" text;
```

Generated with `pnpm db:generate --name company_display_name_en`, with its
journal entry and Drizzle snapshot. No previous migration was edited.
**Generated only, not applied to any database.** Apply the migration through
the separately authorized Supabase process before running this code against
that database. Names are manually curated; no company records were populated,
auto-title-cased or modified during implementation. No deployment occurred.

## Verification

- **Passed in order:** `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test`.
  TypeScript and both lint checks were clean; **88 test files and 1,522 tests passed**.
- Added the four requested compact-money unit cases, plus zero, negative,
  bilingual numeric isolation, unabridged record display and ratio formatting.
- Added tests for admin validation, clearing, omission compatibility, same-
  transaction audit arguments, audit-failure propagation and additive nullable
  migration metadata.
- Added stock/search/metadata tests for curated-name precedence, null/blank
  SEC fallback, Arabic-name precedence and unchanged source fixtures.
- Updated schema-shaped fixtures and admin form-wiring assertions.
- Regenerated review caller locations only: 171 pending rows, zero unresolved
  surfaces, zero unused leaves. No Arabic draft or approval was changed.
- Restarted the app; public home preview returned 200 with no browser errors.
  The signed-in admin UI was not visually verified. Tests cover its form wiring
  and backend mutation contract; no authentication bypass was introduced.
- Database-dependent stock/search browser suites and migration execution were
  not run because hosted access and applied migrations were not authorized.

## Files changed

### Shared formatting and public presentation

- `src/lib/format.ts`
- `src/components/stock/StockVerdict.tsx`
- `src/components/stock/StockVerdictParts.tsx`
- `src/components/stock/ratio-display.ts`
- `src/components/search/SearchResults.tsx`
- `src/stock/metadata.ts`
- `src/stock/types.ts`
- `src/db/stock-public.ts`
- `src/db/search-public.ts`

### Schema, migration and admin

- `src/db/schema/market.ts`
- `drizzle/0015_company_display_name_en.sql`
- `drizzle/meta/0015_snapshot.json`
- `drizzle/meta/_journal.json`
- `src/components/financial/FinancialAdmin.tsx`
- `src/components/financial/ScreeningControls.tsx`
- `src/lib/financial/service.ts`
- `src/screening/contracts.ts`
- `src/screening/data.ts`

### Tests and review context

- `tests/format.test.tsx`
- `tests/company-display-name.test.ts`
- `src/components/stock/StockVerdict.cleanup.test.ts`
- `tests/financial-admin-ui.test.ts`
- `tests/search.test.tsx`
- `tests/stock.test.ts`
- `tests/stock-unknown-fields.test.tsx`
- `tests/public-ux-copy.test.tsx`
- `tests/arabic-follow-up.test.tsx`
- `docs/AR_REVIEW_KEYS.md`
- `docs/ARABIC_REVIEW.md`
- `docs/UX_TWO_VERIFICATION.md`
