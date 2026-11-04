# UX-8 — request this stock

## Scope and authority

Implemented only the founder's latest UX-8 request, superseding the older UX-1
task label. D-144 approves the UX-8 Arabic/English table; D-152 governs owned
requests separately from anonymous unmet-search totals. D-45/D-47 keep ordinary
account capabilities distinct from privileged MFA operations. D-50 account
deletion and D-51 public-page authentication boundaries are preserved.

No Supabase migration, live import, hosted configuration change or deployment
was performed. No legal document, policy version, screening rule, stored
evidence, protected reason template or pending dictionary was changed.

## Implemented

- Filled the existing no-coverage request slot below the screened-ticker links.
  It is not a search API and does not introduce suggestions or change anonymous
  unmet-search recording.
- Browser-only session detection; the signed-out sign-in link also exists in
  server-rendered/no-JavaScript markup. Its return destination preserves the
  search query, including bounded encoded search text. Encoded route delimiters
  and other unsafe OAuth destinations remain rejected.
- Signed-in POST feedback: created, duplicate, cap and retryable failure; saved
  and duplicate buttons are disabled. One polite result announcement, no
  duplicated success announcement. Auth/account/query changes invalidate stale
  responses; same-user token refresh does not cancel an otherwise valid result.
- Private own-query/date list with removal, retry feedback and empty state.
  Reads and deletes use the verified caller's ID, never an ID from the body.
- Admin unmet-search table shows anonymous search totals and distinct-user
  request totals, never requester identities. Existing exact SQL ranking,
  deterministic query tie-break and top-20 boundary are retained.
- Bounded same-origin JSON POST/DELETE, private/no-store/noindex responses and
  the existing D-136 API budget. No request identity/query is echoed or logged;
  parameter-bearing database errors are replaced with opaque failures.
- An explicit all-role, account-scoped `requireRole` opt-in. The existing
  privileged guard remains unchanged by default, including verified TOTP/AAL2.

## Migration

**`drizzle/0020_stock_requests.sql` — prepared, not applied to Supabase.**
Renumbered from `0019` after preserving main's new `0014` analyst-case
migration; SQL contents unchanged.

Creates `app.stock_request` with `(user_id, normalized_query)` primary key,
`created_at`, 1–40-character check, query-count index and cascading user FK.
Only `suhail_app` receives SELECT/INSERT/DELETE; public access is revoked and
RLS enabled. Updates are not granted.

A per-account lock protects the 20-row cap across concurrent inserts. A
duplicate at the cap remains a duplicate, and deleting a row frees a slot.
Repeatable-read inserts fail closed because their count snapshot cannot refresh
after waiting for a lock. The application uses ordinary read-committed inserts.

The generated snapshot reconciles already-authored schema fields from earlier
manual migrations; their DDL was removed from this new migration. No earlier
migration or snapshot was edited.

## Arabic approval

All eleven UX-8 table pairs are registered through the existing approval map,
with earlier approvals retaining precedence. The founder additionally approved:

| English | Arabic |
|---|---|
| Normalized query | عبارة البحث الموحّدة |
| Searches | عمليات البحث |
| Requests | الطلبات |
| Search counts are anonymous; requests count distinct users. | أعداد البحث مجهولة الهوية؛ والطلبات تُحسب حسب عدد المستخدمين المختلفين. |

No conflicting retained translation or unfilled UX-8 key was found. No
out-of-scope pending copy was approved. Generated review documents were refreshed
for current caller locations: **170 pending rows, zero unresolved coverage
surfaces, zero unused message leaves**. Those pending approvals remain pending.

## Verification

- Final ordered command:
  `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test`
  — **passed in that order; 1,724 unit tests passed across 101 files**.
- Full fresh disposable PostgreSQL 17 suite: **266 passed, 14 files**.
- After preserving exact aggregate ranking beyond JavaScript integer precision,
  the affected request persistence suite was rerun: **6 passed**.
- Focused Playwright command:
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium pnpm exec playwright test e2e/stock-requests-fixture.spec.ts --config=playwright.accounts.config.ts --workers=1`
  — **4 passed**: bilingual signed-out return links; signed-in creation and
  identity-free body; account list/date/removal; duplicate/cap/error feedback.
- Live dev-server anonymous POST `/api/stock-requests`: **401** with
  `{"error":"sign_in_required"}`.
- Actual dev search at 375px was visually checked. It correctly renders the
  approved database-error/retry state, not false no-coverage results, while the
  existing database lacks earlier schema changes. Root `/` still fails on
  missing `public_settings.featured_security_id`; earlier inspection also found
  `company.display_name_en` missing. These were not repaired by unauthorized
  database changes.
- Request CTA/account interactions were verified in isolated auth-boundary
  fixtures, not a real signed-in Google/Supabase session. That signed-in live UI
  remains unverified. The older component fixture's header styling is not
  evidence of the actual Next header layout.

An initial broader account-fixture command ran **111 tests: 100 passed, 11
failed**. Two initial UX-8 failures used the pre-fix session fixture; the final
focused UX-8 rerun passed all four. The other nine failures were in existing
account/settings/header/deadline assertions, including an old two-argument
settings expectation where the current UI supplies the existing featured-stock
argument. They were not changed or claimed green:

- Settings same-turn submission assertions, Arabic and English.
- Anonymous header/profile/session assertion.
- Account headings/keyboard-action assertions, Arabic and English.
- Settings helper/keyboard-action assertions, Arabic and English.
- Profile header-stall and body-stall deadline assertions.

## Original privacy question — superseded by the pre-merge update

**Should the privacy policy explicitly describe user-linked stock requests
before launch?** Ask the lawyer: requests store which normalized stocks a
signed-in user asked for and disappear with account deletion. This build does
not approve or edit legal text or change policy versions.

The founder subsequently supplied the exact stock-request privacy bullets and
explicitly requested a privacy-version bump. See
[the pre-merge verification report](UX_8_PREMERGE_VERIFICATION.md).
The supplied additions are implemented there; O-7 lawyer review remains open.

## Subsequent founder acceptance of website wording — 2026-11-04

The founder said: “approve all text in the website when I see an issue i will
tell you to change them do not worry”.

All currently displayed website wording is accepted by the founder; corrections
will be requested as the founder reviews it. Do not reopen approval for unchanged
current wording.

This records acceptance of displayed text, not an instruction to apply unseen
Arabic draft proposals or change the wording. It does not authorize database
migrations or deployment, approve methodology correctness, replace required
legal review, or change accepted policy versions. The O-7 legal review remains
open. No application copy, translation registry, stored template, database or
deployment was changed by recording this acceptance.

## Changed files

Application:

- `src/app/api/stock-requests/route.ts`
- `src/app/[locale]/(private)/account/page.tsx`
- `src/components/search/StockRequestAction.tsx`
- `src/components/search/SearchResults.tsx`
- `src/components/accounts/AccountStockRequests.tsx`
- `src/components/accounts/AccountScreen.tsx`
- `src/components/financial/UnmetSearchPanel.tsx`
- `src/db/schema/search.ts`
- `src/i18n/approved-arabic-stock-requests.ts`
- `src/i18n/stock-request-copy.ts`
- `src/i18n/approved-arabic.ts`
- `src/lib/stock-request-input.ts`
- `src/lib/stock-requests.ts`
- `src/lib/auth/guards.ts`
- `src/lib/auth/paths.ts`
- `src/lib/financial/unmet-search.ts`
- `src/security/route-inventory.ts`

Migration:

- `drizzle/0020_stock_requests.sql`
- `drizzle/meta/0020_snapshot.json`
- `drizzle/meta/_journal.json`

Tests and fixture configuration:

- `tests/stock-requests.test.tsx`
- `tests/stock-requests.integration.test.ts`
- `tests/accounts.integration.test.ts`
- `tests/database.integration.test.ts`
- `tests/db-fixtures.ts`
- `tests/search.test.tsx`
- `tests/browser-fixture/app.tsx`
- `e2e/stock-requests-fixture.spec.ts`
- `playwright.accounts.config.ts`

Documentation:

- `docs/ARABIC_REVIEW.md`
- `docs/AR_REVIEW_KEYS.md`
- `docs/UX_8_VERIFICATION.md`
- `.agents/memory/auth-test-boundaries.md`
