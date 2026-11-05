# UI-8 phone-first display verification — 5 November 2026

## Boundary

D-166 records the founder's standing phone-first public rule; `replit.md` has the requested single Always entry. This is layout/presentation work, not methodology, legal, migration or deployment approval. No engine template, historical approval baseline, input/hash, stored run, financial value, source, threshold or governance flag was edited. No Supabase writes, imports or publication were performed. O-7 remains open.

## Overflow findings

- The exact historical 561px document width did not recur on the current preview before editing: the measured document was 375px.
- The old nowrap version-row mechanism was reproduced in a controlled browser comparison on the actual JPM page. Restoring the long 1.1 label and an unwrapping monospace value increased document width from **375px to 565px**; restoring the display fix returned it to **375px**. This is a controlled reproduction of the mechanism, not a claim to have captured the original 561px page.
- The other concrete issue was the fundamentals table's **768px internal minimum width**. It now becomes stacked label, full-width value and quieter metadata rows up to 900px. Identity/version/hash content can wrap instead of imposing intrinsic width.
- No document/body/public-root overflow hiding was added. Browser tests explicitly reject hidden/clip on those roots.

## Layout and display

- The outer full-record disclosure remains. Screening, known inputs, unknowns, methodology, criteria, fundamentals, sources, prior runs, metadata and full disclaimer each have an independently closed native disclosure. All evidence remains in initial server HTML.
- The exact 1.1 display pair is in a separate `approved-arabic-ui-eight.ts`; the original 26-row UI-1 approval table and historical approval fixtures stay intact.
- The summary uses `الإصدار 1.1 · مسودة`; methodology and the full-record introduction use `الإصدار 1.1 · مسودة، ويعتمد على افتراض الحد الأعلى لدى سهيل`. The full caveat is outside inner disclosures. No unrelated record is assigned this label.
- The stored `approved` workflow evidence remains in its own technical field, not as a misleading badge beside the draft summary label. The stored flag itself is unchanged.
- Inputs are at least 16px; reading/result/evidence text and quiet metadata were enlarged. Public targets have at least 44px height, apart from genuine sentence links. API attribution and source references are explicit targets.
- Footer and fixed public skip-link padding use the bottom safe-area inset. Public hover treatments are hover-capability gated.
- Passive outcome articles still have no `data-ux-card`. Remaining public hover-card targets retain their own radius and padding.
- Shared header changes are public-scoped; no admin redesign.

## Heights at 375×812

Complete document height, outer full record open and **inner sections closed**:

| Page | Arabic | English |
| --- | ---: | ---: |
| KO | 2,987px | 3,115px |
| Apple | 3,227px | 3,316px |
| JPM | 3,130px | 3,256px |

With **every** disclosure open, heights are respectively 12,562 / 13,453 / 12,687px in Arabic and 12,481 / 13,294 / 12,631px in English. Enlarged text, touch targets and stacked evidence make the fully expanded document taller; no evidence was cut to reduce height.

## Tests and checks

- Required command order: `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test` — passed; **117 files, 1,961 tests**.
- New UI-8 browser suite: **8 passed**, covering 36 actual route/locale/width combinations plus every status, no-run, the mapped 1.1 label and a long unbroken unmapped fallback. Actual routes: home, search, KO, Apple, JPM, Al Rajhi methodology; locales Arabic/English; widths 360/375/390px. Every disclosure is open for width, target, input-size and minimum text-size checks. Status starts above 400px and the first reason fits the 375×812 screen.
- Existing UI-1–5 browser suite: **15 passed**, including the answer-first checks and earlier date/ratio/display behavior.
- Existing UI-6 browser suite: **5 passed**, including widened 768/1440px layouts, public 404 recovery and the unchanged private control radius. Total: **28 browser tests passed**.
- Arabic review inventory: **2 existing legal pending rows, 0 unresolved surfaces, 0 unused leaves**. No legal text was changed.
- Screenshots: ignored generated files under `generated-artifacts/ui-eight/`, shared through the Library. Phone captures are 375×812.

### Test-change inventory

- `tests/ui-eight-phone.test.tsx` — new bilingual server-render tests for ten initially closed sections, complete evidence, immutability, short/full version wording, the visible caveat, preserved technical approval evidence and unknown fallback.
- `e2e/ui-eight.spec.ts` — new real-page geometry/touch/type checks and deterministic status/no-run/long-label fixtures.
- `tests/ui-one-browser/render.tsx` — adds local 1.1 and long-label fixture variants only; no runtime data adapter.
- `e2e/ui-three.spec.ts` — only replaces the intro's old ≤36px display budget with 44–64px, retaining compactness while allowing the required touch target. Other assertions stay.
- `src/components/stock/StockVerdict.cleanup.test.ts` — only replaces the 1.1 row's old English display expectation with the approved full Arabic label. All immutable-data, workflow-evidence and metadata assertions remain.
- Main/public Playwright configs now default to 375×812. Explicit desktop coverage and the private account configuration remain intentional exceptions.

## Changed-file groups

- Stock: `StockVerdict.tsx`, `StockSummary.tsx`, `StockVerdict.module.css`, new `StockRecordSection.tsx`, `ApiNinjasAttribution.tsx`.
- Public foundation/layout: `PublicInteractions.css`, `SiteHeader.module.css`, `SiteFooter.module.css`, public `layout.tsx`.
- Other public pages: `HomePage.module.css`, `MethodologyDetail.tsx`.
- Presentation: `approved-arabic-ui-one.ts`, new `approved-arabic-ui-eight.ts`.
- Instructions/evidence: `replit.md`, `DECISIONS.md`, this report.
- Durable diagnostic lesson: `.agents/memory/MEMORY.md` and `rtl-overflow-evidence.md`; the phone policy itself is not duplicated there.
- Tests/fixtures/configs: inventory above; `playwright.config.ts`, hydration, methodology-isr, search, security, stock, ui-one, ui-one-b, ui-six, and new ui-eight configs.

## Limitations

Verification uses automated Chromium and the development preview, not a physical iPhone/Safari or a published deployment. Private signed-in screens were not visually verified. Current preview data is not evidence of deployment freshness or methodology approval. Unmapped labels remain unmodified; this work adds only the supplied exact 1.1 label and does not claim a new exhaustive stored-value audit.
