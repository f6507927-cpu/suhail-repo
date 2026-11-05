# UI-5 — public methodology display

Decision **D-164**, 5 November 2026. D-11 remains intact: no methodology or version
record is edited. No migration, database write, setting change or deployment.

## Result

- UI-1's exact approved mappings apply to the method name, scope, change note,
  verifier, criterion names and known structured keys.
- A short mapped summary and explicit provisional/pending Shariah-analyst-review
  sentence remain visible above one compact card per criterion.
- Cards show the criterion name, unchanged limit and stored localized explanation
  when present. Null numeric limits display **لا ينطبق / Not applicable**, without
  duplicate boolean unit/direction labels on the closed card.
- Definitions, formulas, inputs, treatment rules/data, sources, criterion type,
  effective date, units/direction and borderline margin remain in initially closed
  native **التفاصيل الفنية / Technical details** disclosures in server HTML.
  Source/governance and purification evidence is separately collapsible.
- One localized English-only note covers remaining technical English prose per
  displayed document. Source titles alone do not trigger it. Unknown technical
  prose and the unmapped 1.1 version-title/short-label wording retain their existing
  English fallbacks; no new methodology translations are invented.
- Internal decision IDs are stripped on public presentation copies, including
  expanded content and public text boundaries. Private audit references and
  original stored strings are retained.
- Draft-labelled versions display **مسودة · قيد المراجعة / Draft · Under review**,
  not the enabled-for-production label. Unrelated workflow evidence is retained
  in the closed metadata, and non-draft flag-driven display is unchanged.
- Live-mode directory rendering excludes example/demo methods and demo versions.
  Preview rendering remains unchanged; SITE_MODE itself is not changed.
- Removed `↗` from both the directory's internal documentation link and the stock
  page's internal methodology/version link. Existing external source URLs and
  link attributes remain unchanged.

## Actual stored state, read-only verification

Public-reader inspection of `al-rajhi-adapted` returned:

| Record | Production flag | Workflow | Raw label |
| --- | --- | --- | --- |
| Methodology | `true` | — | — |
| Version 1.1, current public default | `true` | `approved` | `Adapted research 1.1 — draft; Suhail upper-bound assumption` |
| Version 1.0 | `true` | `approved` | `Adapted research 1.0 — draft` |

All six criteria across these versions currently have null `explanation_ar` and
`explanation_en`. No explanations were fabricated. The public read projection now
includes these existing columns, already granted to `suhail_public` by migration
0017. No schema/grant or stored-record change was needed.

These flags are reported as stored facts, not Shariah approval or permission to
change governance. The provisional disclosure remains visible.

## Phone measurements and screenshots

Actual development page, **375 × 812px**, fonts loaded, reduced motion, all
disclosures initially closed:

| Selection | Document height | Document width |
| --- | ---: | ---: |
| Before UI-5, default 1.1 | 9,971px | 375px |
| After UI-5, default 1.1 | **2,241px** | 375px |
| After UI-5, 1.0 | **2,180px** | 375px |

Default-page height is about **78% shorter** at the same viewport. Both selections
show one visible English-only note, a draft-review label, zero open disclosures
and no visible decision IDs. Expanding the actual 1.0 technical content exposed
its source references with no decision IDs or raw snake_case keys.

Actual screenshots and measurements:
`generated-artifacts/ui-five/methodology-375-full.jpg`,
`methodology-375-top.jpg`, and `metrics.json` in that directory.
The app screenshot tool also checked the actual methodology page. This is
development verification, not a claim about a published deployment or physical
iPhone Safari.

## Checks

Final requested sequence passed, in order:

```sh
pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm test
```

**114 test files / 1,933 tests passed.** The existing non-fatal Vite native-loader
warning remains. Arabic inventory: two legal pending rows, zero unresolved
surfaces, zero unused message leaves. O-7 remains open.

**15 browser checks passed:** two new Arabic/English UI-5 phone cases and all 13
existing UI-1/2/3/4 cases, including actual Apple/JPM/KO development-page checks.
UI-5 checks complete technical evidence in initial server HTML, initially closed
disclosures, keyboard opening, phone overflow and compact fixture height.

## Changed files and test inventory

- UI: `MethodologyDetail.tsx`, `MethodologyDirectory.tsx`, and the single internal
  link glyph in `StockVerdict.tsx`.
- Read projection: `src/db/methodology-public.ts`, adding only the two
  already-publicly-granted explanation fields.
- Presentation: new `src/i18n/methodology-display.ts`, public/private text-boundary
  separation in `display-text.ts` and foundation `shared.tsx`, and four new
  bilingual `publicMethodology` keys.
- Copy audit: `scripts/ar-review.ts` registers the retired table caption/criterion
  label separately from historically pinned uppercase decorative labels.
  Dictionary values and independent approval guards stay unchanged. Generated
  `ARABIC_REVIEW.md` and `AR_REVIEW_KEYS.md` are refreshed.
- New `tests/ui-five-methodology.test.tsx`: ten cases covering both locales,
  complete closed technical evidence and nested data, mapped labels/null limits,
  explanations, immutable inputs, draft/non-draft flags, preview/live directory
  visibility, source-title/English-paragraph notice eligibility, public-ID
  stripping versus private audit retention, draft detection and internal links.
- New `tests/fixtures/ui-five-methodology.ts`: deterministic valid UI-only records.
  No active methodology evaluation or hosted data write.
- `tests/fixtures/ui-one-methodology.ts` and `tests/public-ux-copy.test.tsx` add
  null explanation fields to their existing typed fixtures only. **No existing
  assertions are changed.**
- `tests/ui-one-browser/render.tsx` and `playwright.ui-one.config.ts` register the
  new fixture and `e2e/ui-five.spec.ts`'s two cases.
- `docs/DECISIONS.md` records the bounded decision; this file records verification.

Engine/reason templates, historical approval baseline, hash fixtures, stored runs,
status decisions, numbers, thresholds, source records and legal files remain
unchanged. No protected test assertion was edited.
