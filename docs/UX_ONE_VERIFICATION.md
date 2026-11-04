# UX-1 verification

## Scope and existing implementation

Development code, not the published site's apparent age, was the source of
truth. No deployment, hosted configuration, Supabase access, live import,
applied hosted migration, new dependency or UX-2–UX-8 implementation occurred.
Browser database fixtures used disposable loopback PostgreSQL only.

Already present and preserved:

- The exact 30 source phrases represented by the UX-1 table (the combined
  Source / Sources row resolves to two phrases), their D-144 approval registry,
  approval-map integration and matching search dictionary values.
- The public-only review-token wrapper and the unchanged private wrapper.
- Removal of home/search/stock decorative eyebrows and their stock CSS.
- Stock-level fallback aggregation and the single header notice.
- Recursive English-to-Arabic string-key parity, phrase approval,
  public/private marker and stock cleanup tests.

## New fixes

- Removed the remaining public methodology decorative paragraphs:
  PUBLIC RESEARCH / DOCUMENTATION, RESEARCH REGISTER, RULE REGISTER and
  STORED METHODOLOGY DATA. Their element-specific classes disappeared with
  those elements. No dedicated public eyebrow CSS remains.
- Kept real headings, the methodology type, the DOCUMENTED METHODS count
  label, version selectors and ticker/exchange identifiers. These are
  functional labels, not decorative eyebrows.
- Suppressed review tokens in public stored company names, methodology scope
  and version labels, rendered deterministic reasons, validated English
  narrative, methodology records/structured data/version choices, stored-close
  source labels and stock document/social metadata.
- Counted secondary English company identity, displayed version labels and
  close/provider attribution for the one stock notice. Hidden analyst data
  and run-only evidence in no-run states no longer cause false notices.
- Excluded UUIDs and recognized version codes from English-narrative detection.
  Existing numeric, boolean, enum, ticker and exchange isolation remains.
- Preserved the four retired methodology dictionary pairs and D-107 approval
  fixtures. The review audit explicitly reports them as retired, never as
  callers or pending rows; explicit pruning also preserves them.
- Refreshed only generated review boundaries/caller locations. All 171 pending
  inventory rows, their sources, genuine drafts and empty approval cells remain.

Marker removal is presentation-only. It does not approve text, rewrite stored
evidence, change §7.3 templates, modify legal/fixed copy, change policy versions,
or affect the private review wrapper.

## Approval reconciliation

- **Unfilled UX-1 table phrases: none.**
- **Conflicting UX-1 source/key pairs: none.** Every table phrase currently
  resolves to the exact approved Arabic, allowing existing code-token isolation.
- D-130/D-131/D-138 precedence is unchanged. No new approval was recorded.
- In particular, the retained D-130 `inputState.missing` value is
  **غير متوفرة**. The distinct UX-1 phrase `Unavailable` remains
  **غير متوفر**; it is not that missing-input key and is not an overwrite.
- Existing D-138 activity wording and all earlier founder amendments remain
  covered by their independent approval tests.

## Pending public fallback sources outside the UX-1 table

These remain English where called; hiding a token is not a translation.
This is a conditional caller inventory, not a claim that all rows appear
together, nor a count of visible browser markers.

Dictionary keys:

| Key | Retained source |
| --- | --- |
| publicSearch.hint | Enter 1–40 characters of a ticker or company name. |
| publicSearch.noResults | Not covered yet |
| publicSearch.noResultsBody | No listed stocks in the screening universe match this search. |
| storedClose.closingOn | Closing price on |

Stock runtime phrases (there is no dictionary key for these):

1. No reason template available.
2. No criteria were recorded for this run.
3. No calculation trace was stored.
4. AI explanation
5. Arabic narrative is not available; structured evidence only.
6. AI text discarded — showing structured evidence only
7. The generated text did not pass validation against the engine's evidence, so it was discarded. Every figure below comes straight from the engine.
8. Every figure in this text was checked against the engine's evidence.
9. Structured evidence
10. Analyst profile unavailable
11. No screening run recorded for this methodology yet.
12. No result is shown because no stored run is available.
13. No current-period facts were recorded.
14. No sources were stored for this page.
15. Unchanged

Metadata also retains the unapproved source **No run yet**, without the visible
token. D-153's required **Prices: API Ninjas** attribution remains unchanged.
Arbitrary company/analyst names, methodology text and free-text evidence remain
their original identities, not newly approved translations. The stock notice
describes displayed English record content; pending interface phrases above do
not turn an otherwise Arabic record into English-only stored evidence.

## Verification and limitations

- Required order: `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test`.
  **Final result: passed in that exact order; 86 unit files, 1,493 tests passed.**
  An initial unit run found the retired-label audit mismatch and stale generated
  caller locations; these were corrected without deleting approval history.
- Complete stock fixture suite: **19 passed**, including both locales, four
  statuses, covered/uncovered/no-run states, mobile/desktop, light/dark,
  metadata, native calculation disclosures and accessibility checks. Visible
  review-marker counts were zero in all four public evidence matrices.
- Following the metadata fix, both no-run stock browser checks passed again.
- Focused real-Next UX-1 home, empty-search and stock checks: **2 passed**,
  one per locale. Populated search rows are also covered by deterministic
  component tests, including notice counts and preserved identifiers.
- Public methodology tests render populated/empty directories, detail,
  nested evidence and version choices in both locales; stored fixtures remain
  byte-for-byte equivalent after rendering.
- Arabic phone-width and English desktop home preview screenshots show no
  review tokens or decorative eyebrows; browser console had no errors.
- The broader pre-existing search fixture suite was attempted and **11 tests
  failed**. Its server forces `SITE_MODE=live` while seeding demo stocks, and
  the real search query intentionally excludes those stocks in live mode.
  Expected populated rows therefore disappear. That harness/search-policy
  mismatch was not concealed by changing production filtering, fixture
  identity or cache/security expectations. Broad populated-search browser
  coverage remains unavailable pending a separate harness correction.
- Published-site freshness and physical Safari/Firefox behavior were not
  verified. Local results do not establish what build is currently published.

## Files changed for UX-1

- `src/components/methodology/MethodologyCopy.tsx`
- `src/components/methodology/MethodologyDirectory.tsx`
- `src/components/methodology/MethodologyDetail.tsx`
- `src/components/methodology/PublicMethodologyVersions.tsx`
- `src/components/stock/StockVerdict.tsx`
- `src/components/stock/StockVerdictParts.tsx`
- `src/components/stock/StoredMonthlyClose.tsx`
- `src/stock/metadata.ts`
- `scripts/ar-review.ts`
- `tests/ar-review.test.ts`
- `tests/public-ux-copy.test.tsx`
- `tests/stock.test.ts`
- `src/components/stock/StockVerdict.cleanup.test.ts`
- `e2e/stock-fixture.spec.ts`
- `e2e/search-fixture.spec.ts`
- `docs/ARABIC_REVIEW.md`
- `docs/AR_REVIEW_KEYS.md`
- `docs/UX_ONE_VERIFICATION.md`

Pre-existing month-end-provider edits, `.replit`, `next-env.d.ts`,
`docs/DECISIONS.md` and `docs/API_NINJAS_MONTH_END.md` were not manually edited
for UX-1. No migration was added.
