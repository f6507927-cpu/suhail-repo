# UX-8 pre-merge verification — 2026-11-04

## Authorization and scope

The founder accepted UX-8 items 1–6, supplied the exact Arabic and English
stock-request privacy bullets, and requested the four pre-merge checks below.
**No Supabase writes, migrations, deployment or merge were performed.**
Database writes in the integration tests below target disposable local
PostgreSQL 17 only.

The development homepage remains blocked by the missing
`app.public_settings.featured_security_id` column. This report does not claim
to fix that runtime error without the required migration authorization.

## 1. Read-only Supabase migration inspection

Inspected the connected Supabase migration registry and information schema in
explicit read-only transactions. Compared registry timestamps and SHA-256
checksums with the available branch journals and migration files.

All applied migrations through `0013_api_ninjas_closes` match their source
checksums. Main acquired another pending migration during completion-time
syncing; a fresh read-only check confirmed the registry is unchanged. The
following **seven** migrations are unapplied in the final combined source:

| Migration file in `drizzle/` | Database changes awaiting authorization |
| --- | --- |
| `0014_pretest_analyst_cases.sql` | Incoming main-project work, not a new UX-8 behavior: replaces the methodology-version guard function to permit append-only analyst cases at `source_verified`/`rules_normalized` before production, rejecting edits, removals, reordering and duplicates. Does not advance workflow or change criteria/reports. Retained without changing its SQL; not applied or authorized by this follow-up. |
| `0015_company_display_name_en.sql` | Adds nullable `app.company.display_name_en`. No name backfill. |
| `0016_company_display_name_en_public_read.sql` | Grants `suhail_public` SELECT on that new column; existing column grants do not automatically expand. |
| `0017_methodology_criterion_explanations.sql` | Adds nullable `explanation_ar` and `explanation_en` to `app.methodology_criterion`, with explicit public column grants. These are UI explanations, not engine inputs or stored reason templates; existing RLS and immutability remain. |
| `0018_home_featured_security.sql` | Adds nullable `editorial_setting.featured_security_id`, with a foreign key to `security`; extends `app.public_settings`; creates the published editor-pick analyst projection. Does not select a featured stock or update existing content. |
| `0019_published_pick_author_profile.sql` | Replaces that analyst projection to resolve the actual author from the stored author snapshot, requiring an unambiguous user and active analyst profile. Exposes pick/profile IDs, not author email or user ID. |
| `0020_stock_requests.sql` | Creates the owned request table, composite key, query-length constraint, timestamp, query index, RLS/grants, and serialized per-user limit trigger. No UPDATE grant or public access. Duplicates remain idempotent; maximum 20 requests per user; user deletion cascades to requests. See the original UX-8 report for application ownership and aggregation boundaries. |

The six previously prepared UX migrations were renumbered from `0014`–`0019`
to `0015`–`0020` to avoid main's new `0014` prefix. Their SQL checksums and
timestamps are unchanged. Associated snapshots moved from `0014`/`0019` to
`0015`/`0020` without changing their contents or UUID chains; journal indexes
were regenerated uniquely. No applied migration was edited.

The two requested columns are absent in Supabase; this is not a migration that
has been applied but merely needs a server restart.

### Main versus development dependencies

The available references differ. Recorded exact snapshots rather than silently
treating an old local branch as current main:

| Reference | Commit | Dependencies on either requested column | Pending migrations in its journal |
| --- | --- | --- | --- |
| Local `main` | `2735454` | None in `src/` | None |
| Tracking `origin/main` | `a19e1fb` | None in `src/` | None |
| Parent-app snapshot before syncing | `a53be30` | None in `src/` | None |
| UX-8 before syncing | `ae56b98` | Present, as below | Six UX migrations, using their original names |
| Latest parent-app `main-repl/main` | `ffb37eb` | None in `src/` | `0014_pretest_analyst_cases` |
| Combined development working tree | Rebased on `ffb37eb` | Present, as below | All seven listed above |

These are the repository's available refs, not a claim to have refreshed a
remote deployment or inspected its running code.

**Current development dependencies:**

- `src/db/schema/market.ts`: maps the new English display-name column.
- `src/db/search-public.ts`: selects and searches it. Search rendering receives
  that display-name projection.
- `src/db/stock-public.ts` and `src/screening/data.ts`: select it in their company
  projections. Stock rendering and metadata consume the resulting identity.
- `src/lib/format.ts` and `src/stock/types.ts`: retain the optional display-name
  contract and SEC-name fallback.
- `src/lib/financial/service.ts` and
  `src/components/financial/FinancialAdmin.tsx`: audited display-name edits and
  the corresponding admin input.
- `src/db/schema/editorial.ts`: maps the featured-security foreign key.
- `src/db/home-public.ts`: directly selects
  `public_settings.featured_security_id`; its published-research query also
  selects `company.display_name_en` and consumes `app.public_pick_analyst`.
- `src/lib/auth/admin-data.ts` and `src/lib/auth/admin-mutations.ts`: settings
  read/edit paths include the featured selection.

Consequently, the reported development runtime failure is an unmerged
code/schema mismatch. Applying only a single missing column would not satisfy
the other new development dependencies. No compatibility fallback or partial,
untracked schema patch was introduced.

## 2. Broader account-browser comparison

Initially ran the complete account-browser configuration on four isolated source
snapshots, without checking out or changing either main branch:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium \
  pnpm exec playwright test --config=playwright.accounts.config.ts \
  --workers=1 --reporter=json
```

All runs used the same installed browser/toolchain. The parent-app main and
development lockfiles are identical. The older local main used that same
installed dependency set, not a fresh installation of its older lockfile.
The pre-UX-8/UX-8 snapshot harnesses changed only their fixture-server port to
3301 so they could run beside main on port 3300; no application source changed.
Results are fixture-browser evidence, not real Supabase/Google session evidence.

| Snapshot | Passed | Failed | Flaky/skipped |
| --- | ---: | ---: | ---: |
| Local `main`, `2735454` | 107 | 0 | 0 |
| Parent-app main, `a53be30` | 107 | 0 | 0 |
| Development immediately before UX-8, `e2b05df` | 98 | 9 | 0 |
| UX-8, `ae56b98` | 102 | 9 | 0 |

**Conclusion: the nine failures are not present on either tested main. They
already exist in pre-UX-8 development, and UX-8 introduces no additional
failures.** Compared exact failing file/line/title identities between the two
development runs; all nine match. The four additional UX-8 browser tests pass.
This historical comparison was not a green overall development account-browser
suite. See the subsequent fixture triage below for the corrected final run.

The nine historical failing cases, not repaired during the initial comparison:

| File under `e2e/` | Cases |
| --- | --- |
| `accounts-fixture.spec.ts:7` | Arabic and English settings action argument assertions expect the older two-argument call rather than the featured-selection argument. |
| `accounts-fixture.spec.ts:102` | Anonymous/private-profile header test expects old account initials in the header summary. |
| `accounts-locales-fixture.spec.ts:56` | Arabic and English account keyboard focus assertions. |
| `accounts-locales-fixture.spec.ts:253` | Arabic and English settings keyboard focus assertions. |
| `profile-deadline.spec.ts:4` | Header-stall and body-stall cases expect old account initials in the summary. |

Raw JSON results are retained under
`generated-artifacts/ux8-before-merge/`, excluded from Git/deployment.

After main advanced to `ffb37eb`, the full suite was rerun on that exact main
snapshot and on the combined working tree. Main again passed **107/107**;
combined development passed **102**, with the **identical nine failures**
and no flaky or skipped cases. The four original snapshot results remain
evidence that these failures predate UX-8.

## 3. Account-scope role/MFA regression

Added parameterized integration coverage using the real guards, admin settings
reader/action, methodology admin/editor reader, and private page guard:

- Prime the all-role account-scoped guard for each of user, editor and admin.
- With AAL1, test both missing and present verified factors: protected readers,
  the settings action, and the admin/editor page guard still reject access.
- With verified MFA/AAL2, an ordinary user still cannot reach either role's
  protected reader or the settings write.
- A verified editor can read methodologies but cannot read/save admin settings.
- A verified admin can read both protected datasets.

The account-scoped opt-in therefore does not grant a privileged role or
satisfy privileged MFA. Production guard code was not weakened or rewritten.

## 4. Supplied privacy additions and re-acceptance

- Added all six exact supplied bullets, AR and EN, in sections 2, 3 and 7 at
  the requested positions.
- Arabic remains the prevailing text.
- Both source files retain `⟦LEGAL-REVIEW⟧`; Arabic also retains
  `⟦AR-REVIEW⟧`. Existing public marker presentation is unchanged.
- Privacy version: **`draft-2026-11-04`**. Terms remain
  **`draft-2026-10-11`**, with unchanged Terms hashes.
- Updated the pinned privacy wording hashes:
  - AR: `4ddd48b027de63ce91c18eecad9691f150d475b0c9d0fdfcd17221c64cb4ea84`
  - EN: `e5def5ff883c12b3588888401324d1bb08566836f62a7e70d0a7cde7569581e2`
- Refreshed both Arabic review inventories and the saved draft inventory.
  All three new Arabic lines remain in pending `L-privacy-body`; this is not
  legal approval or promotion of Arabic legal drafts.
- Added exact bullet/section, review-inventory, marker/version/hash and
  re-consent tests. A local integration regression proves an account with the
  previous privacy version is denied even account-scoped access until it
  accepts the new version through the real consent endpoint.
- No existing Supabase acceptance records were rewritten, and no new migration
  is required for this policy-version change. Re-acceptance takes effect when
  this code runs; it does not claim the published app has been updated.
- O-7 lawyer review remains open.

## Verification before completion-time syncing

- `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test`:
  **passed in that order; 1,738 unit tests, 103 files**.
- Fresh disposable PostgreSQL 17 full suite: **270 passed, 14 files**.
- Final working-tree UX-8 browser suite: **4 passed**.
- Arabic privacy page: dev-server HTTP 200 and full-page visual check; the
  supplied bullets and new version render with the existing draft banner.
- English privacy page: proxied dev-server HTTP 200; response checks confirm
  all three supplied bullets, new version, draft banner and Arabic precedence.
- Broader browser comparison: results and nine outstanding failures above.
- Development homepage: still HTTP 500 from the explicitly unapplied
  featured-security migration. Supabase remains unchanged as instructed.

## Final verification after syncing

- `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test`:
  **passed in order; 1,760 unit tests, 104 files**.
- Fresh disposable PostgreSQL 17, including incoming main's guard migration:
  **287 passed, 15 files**.
- Latest main `ffb37eb` full account-browser suite: **107 passed**, no failures,
  flaky tests or skipped tests.
- Combined development full account-browser suite: **102 passed, 9 failed**,
  no flaky/skipped tests. Exact failing file/line/title identities still match
  pre-UX-8 development. All four UX-8 request cases pass in this final run.
- The previously verified privacy rendering is unchanged by these migration
  filename/index corrections.

## Subsequent nine-failure triage and migration-plan confirmation

All nine were test/fixture problems, not reproduced product bugs. Production
components, authentication, deadlines and keyboard behavior were left unchanged.
The corrected tests retain the behavioral checks rather than removing them.

1. **Arabic settings submission/retry — fixture:** expected two action arguments; the featured-stock setting correctly supplies a third nullable argument.
2. **English settings submission/retry — fixture:** same stale two-argument expectation; reentrant submission and focus restoration checks remain.
3. **Anonymous header and session-role switching — fixture:** expected initials removed by UX-3; now opens the menu and checks the ordinary user's identity, absence of the previous admin identity, and absence of admin links.
4. **Arabic account keyboard/language/deletion flow — fixture:** assumed the theme toggle was the final header control; now enters the form by Tab from the language-switch link, the actual final header link.
5. **English account keyboard/language/deletion flow — fixture:** same obsolete header tab-stop assumption; language, policy-link and deletion keyboard assertions remain.
6. **Arabic settings keyboard/save/retry flow — fixture:** skipped the added featured-stock input; now tabs through it, types `nasdaq-aapl`, and verifies the saved and retried arguments include it.
7. **English settings keyboard/save/retry flow — fixture:** same missing input in the expected focus sequence; keyboard focus and action arguments are checked explicitly.
8. **Profile header-stall timeout and late-role protection — fixture:** expected initials in the now text-only account summary; still checks the exact eight-second deadline, then the actual menu identity and absence of late admin content after the stale response settles.
9. **Profile body-stall timeout and late-role protection — fixture:** same obsolete summary expectation; response settlement and ordinary-user identity/admin-link checks preserve race coverage.

Final full account-browser suite: **111 passed, 0 failed, 0 flaky, 0 skipped**.
Raw final results:
`generated-artifacts/ux8-before-merge/classified-account-final.results.json`.
The earlier 9-failure and intermediate 2-failure results are historical, not
the final classification.

The ordered typecheck/lint/logical-lint/unit sequence passed again: **1,760
tests, 104 files**. Final edited browser specs also passed typecheck and
targeted ESLint. Integration results above remain valid: no application,
schema, migration or integration-test behavior changed in this triage.

### Exact pending migration plan

A fresh explicit read-only Supabase registry query found **0014 is not
applied**. All recorded hashes match migrations `0000` through `0013`; the
latest applied `created_at` is **1792402529669**. Therefore the founder's
conditional timestamp refresh does not apply: **0015–0020 timestamps were
left unchanged**, and the journal has no diff.

Using Drizzle's actual `readMigrationFiles` output and the recorded latest
`created_at`, `pnpm db:migrate` would apply exactly these files in order:

| Order | File under `drizzle/` | Journal `when` / recorded migration `created_at` |
| ---: | --- | ---: |
| 1 | `0014_pretest_analyst_cases.sql` | 1792402529670 |
| 2 | `0015_company_display_name_en.sql` | 1793662592989 |
| 3 | `0016_company_display_name_en_public_read.sql` | 1793710953404 |
| 4 | `0017_methodology_criterion_explanations.sql` | 1793716000000 |
| 5 | `0018_home_featured_security.sql` | 1793749000000 |
| 6 | `0019_published_pick_author_profile.sql` | 1793749000001 |
| 7 | `0020_stock_requests.sql` | 1793795011245 |

This is the plan for the prepared combined source and the inspected registry,
not a promise about a registry changed by someone else before migration.
**The migrator was not invoked; no Supabase writes or deployment occurred.**

## Files changed for this pre-merge follow-up

- `content/legal/privacy.ar.md`
- `content/legal/privacy.en.md`
- `src/lib/auth/policies.ts`
- `tests/accounts.integration.test.ts`
- `tests/legal-drafts.test.tsx`
- `tests/arabic-approval.test.ts`
- `docs/ARABIC_REVIEW.md`
- `docs/AR_REVIEW_KEYS.md`
- `docs/arabic-drafts.json`
- `docs/UX_8_VERIFICATION.md`
- `docs/UX_8_PREMERGE_VERIFICATION.md`
- `.agents/memory/MEMORY.md`
- `.agents/memory/repository-authority.md`
- `.agents/memory/structural-merge-conflicts.md`
- `tests/company-display-name.test.ts`
- `tests/home-ux-six.test.tsx`
- `tests/stock-ux-five.test.tsx`
- `docs/UX_TWO_VERIFICATION.md`
- Six pending UX migration filename renames, listed in the migration table.
- `drizzle/meta/0015_snapshot.json` and `drizzle/meta/0020_snapshot.json`
  (renamed from `0014` and `0019`, contents unchanged).
- `drizzle/meta/_journal.json`
- `e2e/accounts-fixture.spec.ts` (subsequent fixture triage)
- `e2e/accounts-locales-fixture.spec.ts` (subsequent fixture triage)
- `e2e/profile-deadline.spec.ts` (subsequent fixture triage)

**New SQL behavior authored in this follow-up: none.** Main's new migration was
preserved and the unapplied UX migrations were renumbered, not rewritten or
applied. No Supabase writes or deployment were performed.
