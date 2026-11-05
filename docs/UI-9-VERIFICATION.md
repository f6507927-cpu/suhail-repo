# UI-9 verification — 5 November 2026

Decision: **D-167**. Latest founder scope: admin UX only.

## Checks

Final requested sequence, in order:

1. `pnpm typecheck` — passed.
2. `pnpm lint` — passed, no warnings.
3. `pnpm lint:logical` — passed.
4. `pnpm test` — **119 files, 1,973 tests passed**.

`playwright.ui-nine.config.ts` — **28 tests passed**, using only isolated mock
data at **375×812** and **1366×768**. Covered methodologies, securities,
ingestion, settings, audit, users, editions, analysts and stored-run detail.
Checked both RTL edges and document/body widths, including open disclosures.
The selected stock record with only Company details open measured **2,144px**
high at 375×812; document width was 375px.

Browser coverage also includes local ticker/Arabic-name stock search, default
screening preselection, seven initially collapsed/open record groups, missing
financial-heading fallback, no-write bulk cancellation, actual bulk versions,
running-job disabling without disabling resume, example/default option
visibility, preserved saved featured slugs while filtering, English-name
featured-stock search, phone menu, native audit filters and named Arabic dates.

The preview workflow restarted cleanly. Temporary mock servers and their
automatically created port mapping were removed after verification.

## Changed production files

- `src/components/accounts/AdminScreens.tsx`,
  `src/components/accounts/AdminUx.module.css`: responsive menu, users, audit,
  settings picker, version markers and admin size/overflow rules.
- `src/components/financial/FinancialAdmin.tsx`,
  `ScreeningControls.tsx`, `AdminRecordSection.tsx`,
  `AdminRunConfirmation.tsx`, `AdminJobHistory.tsx`: stock list/detail groups,
  mapped financial headings, confirmations and readable job history.
- `src/components/methodology/AdminMethodologies.tsx`: initially closed
  criteria, null-limit wording and technical-ID disclosures.
- `src/i18n/approved-arabic-ui-nine.ts`, `admin-presentation.ts`,
  `approved-arabic.ts`: exact approval table and admin render helpers. The shared
  registry adds missing vocabulary only; all earlier pairs retain precedence.
- `src/lib/auth/admin-data.ts`, `src/screening/data.ts`,
  `src/screening/contracts.ts`: guarded read-only picker/default/count metadata.
- Protected admin audit/settings pages: pass the new display options through
  existing guarded loaders.
- `docs/DECISIONS.md`: D-167, including source-table authority and scope limits.

No action implementation, job implementation, role/AAL2 guard, audit write,
database schema/migration, engine, immutable hash, historical approval baseline,
methodology content, financial record or legal body was edited.

## Test changes

- New `tests/ui-nine-admin.test.tsx`: every exact supplied pair in both locales,
  distinct counts, known-key/fallback labels, frozen inputs, numeric-first
  versions and server-rendered native disclosures.
- New `tests/ui-nine-admin-roles.test.ts`: seven existing action/read entry
  points reach their unchanged required-role arrays before work after denial.
  These are mocked boundary tests, not real AAL2-session verification.
- New `e2e/ui-nine-admin.spec.ts`, `playwright.ui-nine.config.ts` and
  `tests/ui-nine-browser/*`: isolated local component browser fixtures.
- `tests/financial-admin-ui.test.ts`: only the extracted retry callback wiring
  assertion changed; it still verifies that the stored error security ID reaches
  the unchanged ingest payload. All other assertions remain.
- `tests/home-ux-six.test.tsx`: replaced obsolete free-text featured-slug
  assertions with the new select/no-featured option and no hardcoded AAPL
  checks. Its SQL no-data-write assertion remains unchanged.
- Existing browser fixture helpers only export their existing financial seeds
  and optionally omit a duplicate test shell. No runtime auth bypass was added.

## Data and verification boundaries

- Bulk stock count uses the same in-universe selection as existing jobs.
  Screening confirmation lists the existing editorial-default plus eligible
  production version set; the single-stock selector does not alter bulk jobs.
- Audit events have an existing enum. Entities do **not**: they are stored text,
  so their dropdown uses distinct existing values without narrowing filters.
- There is no analyst-profile creation screen/action. The guarded preview-only
  demo seed can create demo profiles but refuses live mode. No seed was run.
- No live database records were queried for a label inventory. In local fixtures,
  `Unmapped analyst measure` / `analyst_custom_metric` and
  `Unknown stored audit summary` deliberately remain unmarked English.
  Synthetic method/version labels such as `Al Rajhi Adapted`,
  `Version 1.0 · Draft` and `Version 1.1` also keep their existing fallbacks.
  These are fixture values, not a claim about hosted records.
- Screenshots in `generated-artifacts/ui-nine/*-375x812.png` show **local mocked
  data**, not an authenticated hosted admin session. Real signed-in UI/MFA
  sessions, production jobs and live data were not verified or changed.
- No deployment, import, production write or profile provisioning was performed.
