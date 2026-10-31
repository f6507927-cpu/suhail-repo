# Public UI review verification

## Approval and scope

- D-130 records the original UI-label approval, every founder amendment, and
  the six outstanding batch-2 corrections before application.
- D-131 records all 23 supplemental labels approved exactly as written.
- The exact submitted rows and amendments remain in
  `PUBLIC_UI_LABEL_REVIEW.md`; render tests pin the supplemental table and the
  earlier approval fixtures remain historical records.
- No pending UI-label mappings from either batch remain. Other Arabic copy,
  screening-template and legal approvals remain outside this review. Their
  English fallbacks are still marked, not represented as completed translations.
- No engine, stored evidence, database schema, imports, authentication
  enforcement, post-MFA continuation, edge activation or deployment changes.
  `docs/SUHAIL_BUILD_REFERENCE.md` is unchanged.

## Review coverage

| Item | Implementation and regression coverage |
| --- | --- |
| 1 — language notices | Section-boundary notices only for narrative fallback; no notices on tickers, exchanges, versions, periods, accessions or numeric values. Per-section notice assertions and isolated-value render tests. |
| 2 — display mappings | Explicit mappings for all requested enums, complete methodology/SEC line-item selectors and activity categories. Exhaustiveness, unknown/prototype safety and exact approved-copy tests. Missing-evidence names are not assumed to be keys: known line-item keys are translated, while stored free-text definitions retain their identity as marked, bidi-isolated language fallbacks. |
| 3 — evidence structure | Separate label/value elements and bidi isolation; no synthetic `—:` or dot separators in numerator/denominator cells. |
| 4 — responsive criteria | Cards below 1200px; named keyboard-focusable contained table region above it. Both table edges reachable in RTL/LTR at 1366px; headers checked for at most two lines. |
| 5 — intact identifiers | Non-wrapping version/code chips; actual numeric and identifier surfaces retain mono/bidi treatment. |
| 6 — bilingual fallback | Available Arabic company name is the Arabic H1. Missing-language blocks are start-aligned, with isolated language/direction spans and valid inline/block structure. |
| 7 — typography | Methodology/admin human labels and dates no longer inherit mono/letter spacing. IDs, hashes, JSON, numeric inputs and numeric values retain appropriate formatting. |
| 8 — developer labels | Profile-image developer note and GOOGLE OAUTH footer removed. |
| 9 — duplication | Distinct period/filing/data dates retained without duplicate data-date labels; equal exchange aliases suppressed. One full disclosure plus one native footer anchor. Header search hidden on localized home/search, with a usable placeholder elsewhere. |
| 10 — unavailable picks | Weekly picks hidden while no page exists. |
| 11 — search rows | Common fixed/flexible grid tracks across results; neutral unscreened badge. Real-app geometry checks compare the common logical column edges in both locales. |
| 12 — shared dates | Date callers use the existing Gregorian/Latin-digit locale formatting policy; no parallel date policy introduced. |
| 13 — global 404 | Actual unmatched routes return 404 with the branded standalone recovery shell and localized hydrated title. Both home links exist before hydration and work without JavaScript. No server request-based locale inference. |
| 14 — empty/boolean states | Accurate approved passing/no-reasons copy; boolean criteria omit ratio, numerator, denominator and calculation fields in cards, tables and evidence summaries. |
| 15 — navigation | Exactly one method/version-aware breadcrumb, with selection/reload coverage for both version and parent-method changes. Criteria/Reports stay in-page anchors. No methodology/report/sign-in/consent BackLinks. MFA exits only to public home, with no protected header links; successful verification still follows validated continuation. |
| 16 — decoration | Decorative methodology-creation and matching financial-admin layers removed. Functional dialog backdrops/focus controls retained. |

## Verification

- `pnpm ar-review:list`: 277 live pending rows outside the approved label
  batches, zero unresolved caller surfaces, zero unused message leaves.
- `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`: passed.
- `pnpm test`: 57 files, 1,012 tests passed.
- Engine coverage: 225 tests passed; statements, branches, functions and lines
  remain fully covered.
- Stock browser suite: 15 tests passed, including the four locale/width
  combinations and the existing metadata/SSR/evidence/accessibility checks.
- Account/methodology/financial fixtures: 98 tests passed across the full run
  and the isolated rerun of two browser-crash failures.
- Real copied-production public suite: 11 tests passed. This uses the real
  routes and public database role against disposable loopback PostgreSQL;
  the database adapter exists only in the ignored generated test copy.
- Root production build and selected production suite: build passed, eight
  recovery/auth-navigation/disclosure tests passed.
- Browser-heavy suites were rerun serially after simultaneous builds/browsers
  exhausted the workspace's thread allowance. Assertions were not weakened.
- Matrix checks report no unintended page/element overflow and no
  serious/critical axe violations, including actual global 404s. Screenshots
  and marker-count attachments are retained in ignored test outputs.
- Missing-input render regressions generate actual engine missing-denominator
  and stale-data unknowns, project their stored names, and render the entire
  stock page in both locales. They assert distinct field identities, approved
  known-key labels, isolated marked fallbacks and at most one section notice.

## Visible review-marker counts

The pre-change stock baseline was reconstructed from the pre-task source and
its CSS against the same unchanged disposable stock evidence. It is a
component baseline, not a claim about a previously deployed app. Counts use
rendered `innerText`, excluding CSS-hidden table/card alternatives.

| Surface | Arabic, 390px | Arabic, 1366px | English, both widths |
| --- | ---: | ---: | ---: |
| Pre-change `demo-fixa` stock component | 223 | 188 | 0 |
| Updated `demo-fixa` stock component / real stock route | 46 | 46 | 0 |
| Real home | 1 | 1 | 0 |
| Real populated search | 1 | 1 | 0 |
| Real methodology directory | 0 | 0 | 0 |
| Actual global 404 | 0 | 0 | 0 |
| Closed methodology-management fixture | 0 | 0 | 0 |

The original stock component emitted 100/95 “English only” notices at
390px/1366px, respectively. The replacement is checked for no more than one
notice per affected section, and no individual identifier notices.

Remaining stock markers are broader explanatory/UI wording and existing
screening-template drafts, not untranslated enum or line-item labels.
Legal-review markers are a separate gate and are not counted as AR-REVIEW.
This work does not grant approval to either category.

## Verification limits

Automated Chromium and isolated signed-in UI fixtures are not live Google,
admin/editor MFA, hosted Supabase or physical iPhone Safari verification.
Firefox/WebKit evidence-layout coverage and a real root-layout crash test are
separate follow-ups. No publication, migration or live-data operation occurred.
