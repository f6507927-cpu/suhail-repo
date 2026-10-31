# Suhail — Step 4 foundation handoff

## Scope and decisions
- Step 4 only: dark-first, Arabic-first public shell and development styleguide. No migrations. Database, health endpoint, screening engine and its Arabic reason templates are unchanged.
- D-21: ar/en, Arabic without prefix, no detection or locale cookie, explicit static locale and Gregorian/Western-digit formatting.
- D-22: default dark HTML; explicit localStorage light/dark choice; isolated before-paint script. Locale switching uses a document navigation to preserve it.
- D-37: seal requires BOTH analyst coverage and passing status. Original dark seal; original polygon with Brass Deep fill for light.
- D-40: fixed early script; no new nonce, auth, preview protection or deployment. CSP implementation remains later work.
- D-19/D-20: static/SSG public rendering, revalidate=900. D-04/D-57: no live quotes.
- §4.1–4.6 and §4.2a applied; superseded §4.7 styling avoided. §7.1 labels and §11 fixed text preserved.
- Original nine SVGs and founder reference untouched. Baseline is fixed; tests never regenerate it.
- Raw --muted is founder secondary TEXT (#5C6467). shadcn's surface meaning is --muted-surface; Tailwind bg-muted maps only to that. All semantic assignments absent from the brief are proposals below, NOT founder approval.
- Sand Deep remains available for table headers; proposed light secondary/muted surfaces use brief #EFEAE0 so secondary text and outlines remain accessible.
- Header remains Night in both modes. Methodologies link deliberately points to /methodology (or /en/methodology); destination is NOT implemented in this step.
- Full disclaimer is an expandable component in the shell, not a new legal-content route.

## Verification
- pnpm typecheck, pnpm lint, pnpm lint:logical, pnpm test and pnpm build pass.
- Unit/regression suite: 324 tests, including brand exact-file SHA-256 preservation, real PNG dimensions and ICO entries, reproducible exports, dictionary extraction/parity/review markers, all badge icon/label pairs, D-37 eligibility, formatting, early script and required contrast pairs.
- Development Playwright: 7 tests pass, including existing health check, AR/EN HTML lang/dir, same-path language switch, persisted theme, keyboard skip link, full disclaimer and no runtime Google font requests.
- Four full-page styleguide captures attached to their Playwright tests; each axe-core scan has zero serious/critical violations.
- Production Playwright: both styleguides return 404, public home locales render, no locale cookie, manifest is available and health remains ok. Build output confirms statically prerendered public pages.
- Workspace browser command: PLAYWRIGHT_CHROMIUM_EXECUTABLE=$(command -v chromium) pnpm test:e2e. The managed Chromium is used because the versioned Playwright download is not installed here; CI installs its matching Chromium.
- Preview paused before Playwright and restored afterward. No database integration, deployment or launch check was requested or performed.

## Dependencies and rationale
- next-intl: validated URL locale routing, static-safe messages and locale-aware links.
- lucide-react: specified accessible status/error/direction/control icons at stroke 1.6.
- @radix-ui/react-slot: shadcn-style Button asChild composition and Slottable.
- clsx + tailwind-merge: primitive variant/class composition without physical-direction utilities.
- sharp (development): repeatable SVG-to-PNG exports and image-dimension regression checks. ICO directory is encoded directly with lossless PNG entries; no extra encoder dependency.
- @axe-core/playwright (development): automated accessibility scans of all four locale/theme samples.

## Files changed
- `.agents/memory/MEMORY.md`
- `.agents/memory/locale-theme-navigation.md`
- `.agents/memory/next-dev-test-locks.md`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.replit`
- `.replitignore`
- `docs/FOUNDATION_HANDOFF.md`
- `e2e/foundation.spec.ts`
- `e2e/production.spec.ts`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `playwright.config.ts`
- `playwright.production.config.ts`
- `pnpm-lock.yaml`
- `public/icons/favicon.ico`
- `public/icons/icon-16.png`
- `public/icons/icon-180.png`
- `public/icons/icon-192.png`
- `public/icons/icon-32.png`
- `public/icons/icon-512.png`
- `scripts/brand-icons.ts`
- `scripts/foundation-report.ts`
- `src/app/[locale]/(public)/layout.tsx`
- `src/app/[locale]/(public)/page.tsx`
- `src/app/[locale]/(public)/styleguide/page.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/page.tsx`
- `src/components/foundation/AnalystByline.tsx`
- `src/components/foundation/BrandMark.tsx`
- `src/components/foundation/ConfidenceNote.tsx`
- `src/components/foundation/CoverageSeal.tsx`
- `src/components/foundation/DemoBanner.tsx`
- `src/components/foundation/Disclaimer.tsx`
- `src/components/foundation/Emphasis.tsx`
- `src/components/foundation/EmptyState.tsx`
- `src/components/foundation/EngineStatement.tsx`
- `src/components/foundation/ExampleMethodologyBanner.tsx`
- `src/components/foundation/FullDisclaimerLink.tsx`
- `src/components/foundation/LocaleSwitcher.tsx`
- `src/components/foundation/Lockup.tsx`
- `src/components/foundation/Num.tsx`
- `src/components/foundation/PriceDirection.tsx`
- `src/components/foundation/StatusBadge.tsx`
- `src/components/foundation/SystemError.tsx`
- `src/components/foundation/ThemeToggle.tsx`
- `src/components/foundation/index.ts`
- `src/components/foundation/shared.tsx`
- `src/components/ui/button.tsx`
- `src/i18n/messages/ar.json`
- `src/i18n/messages/en.json`
- `src/i18n/navigation.ts`
- `src/i18n/request.ts`
- `src/i18n/routing.ts`
- `src/lib/format.ts`
- `src/lib/palette.ts`
- `src/lib/theme-script.ts`
- `src/proxy.ts`
- `tests/fixtures/brand-sha256.json`
- `tests/foundation.test.ts`

## Semantic mappings and actual WCAG contrast
Every proposed semantic value is labeled PROPOSAL. Text requires ≥4.5:1; meaningful outlines/icons require ≥3:1 against adjacent surfaces. Low-contrast decorative separators/surface pairs are not relied on for boundaries or state; required borders are separate.

| Approval | Mapping / value | Foreground or first surface | Background or adjacent surface | Ratio | Requirement |
| --- | --- | --- | --- | --- | --- |
| Specified | dark background / foreground | #E6EFEE | #0B2E33 | 12.35:1 | Text ≥4.5:1 |
| Specified | light background / foreground | #14181A | #F5F1E9 | 15.86:1 | Text ≥4.5:1 |
| PROPOSAL | dark card #061E21 / foreground #E6EFEE | #E6EFEE | #061E21 | 14.77:1 | Text ≥4.5:1 |
| PROPOSAL | dark popover #061E21 / foreground #E6EFEE | #E6EFEE | #061E21 | 14.77:1 | Text ≥4.5:1 |
| PROPOSAL | dark secondary #061E21 / foreground #E6EFEE | #E6EFEE | #061E21 | 14.77:1 | Text ≥4.5:1 |
| PROPOSAL | dark muted-surface #061E21 / foreground #E6EFEE | #E6EFEE | #061E21 | 14.77:1 | Text ≥4.5:1 |
| Specified | light card #FFFFFF / foreground #14181A | #14181A | #FFFFFF | 17.87:1 | Text ≥4.5:1 |
| PROPOSAL | light popover #FFFFFF / foreground #14181A | #14181A | #FFFFFF | 17.87:1 | Text ≥4.5:1 |
| PROPOSAL | light secondary #EFEAE0 / foreground #14181A | #14181A | #EFEAE0 | 14.90:1 | Text ≥4.5:1 |
| PROPOSAL | light muted-surface #EFEAE0 / foreground #14181A | #14181A | #EFEAE0 | 14.90:1 | Text ≥4.5:1 |
| Specified | dark muted-foreground #919A9D | #919A9D | #0B2E33 | 5.03:1 | Text ≥4.5:1 |
| PROPOSAL | dark muted-foreground #919A9D | #919A9D | #061E21 | 6.02:1 | Text ≥4.5:1 |
| Specified | light muted-foreground #5C6467 | #5C6467 | #F5F1E9 | 5.37:1 | Text ≥4.5:1 |
| Specified | light muted-foreground #5C6467 | #5C6467 | #FFFFFF | 6.05:1 | Text ≥4.5:1 |
| PROPOSAL | light muted-foreground #5C6467 | #5C6467 | #EFEAE0 | 5.04:1 | Text ≥4.5:1 |
| PROPOSAL | dark primary #C08B3E / primary-foreground #0B2E33 | #0B2E33 | #C08B3E | 4.82:1 | Text ≥4.5:1 |
| PROPOSAL | light primary #0B2E33 / primary-foreground #E6EFEE | #E6EFEE | #0B2E33 | 12.35:1 | Text ≥4.5:1 |
| PROPOSAL | dark accent #E0BC85 / accent-foreground #0B2E33 | #0B2E33 | #E0BC85 | 8.05:1 | Text ≥4.5:1 |
| PROPOSAL | light accent #88632C / accent-foreground #FFFFFF | #FFFFFF | #88632C | 5.43:1 | Text ≥4.5:1 |
| PROPOSAL | dark border / input / ring #919A9D | #919A9D | #0B2E33 | 5.03:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | dark border / input / ring #919A9D | #919A9D | #061E21 | 6.02:1 | Meaningful outline/icon ≥3:1 |
| Specified | light border / input #998154 | #998154 | #F5F1E9 | 3.32:1 | Meaningful outline/icon ≥3:1 |
| Specified | light border / input #998154 | #998154 | #FFFFFF | 3.73:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | light border / input #998154 | #998154 | #EFEAE0 | 3.12:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | light ring #88632C | #88632C | #F5F1E9 | 4.82:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | light ring #88632C | #88632C | #FFFFFF | 5.43:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | light ring #88632C | #88632C | #E3DBCC | 3.95:1 | Meaningful outline/icon ≥3:1 |
| PROPOSAL | dark destructive #E6EFEE / destructive-foreground #0B2E33 | #0B2E33 | #E6EFEE | 12.35:1 | Text ≥4.5:1 |
| PROPOSAL | light destructive #14181A / destructive-foreground #FFFFFF | #FFFFFF | #14181A | 17.87:1 | Text ≥4.5:1 |
| PROPOSAL | dark decorative divider #14595E | #14595E | #0B2E33 | 1.80:1 | Decorative only; no required contrast |
| Specified | light decorative divider #D9D1C2 | #D9D1C2 | #F5F1E9 | 1.35:1 | Decorative only; no required contrast |
| PROPOSAL | dark card adjacent to page (outline required) | #061E21 | #0B2E33 | 1.20:1 | Decorative only; no required contrast |
| Specified | light card adjacent to page (outline required) | #FFFFFF | #F5F1E9 | 1.13:1 | Decorative only; no required contrast |
| Specified | dark brass byline / emphasis / seal #C08B3E | #C08B3E | #0B2E33 | 4.82:1 | Text ≥4.5:1 |
| Specified | dark price up #26A8B1 | #26A8B1 | #0B2E33 | 5.04:1 | Text ≥4.5:1 |
| Specified | dark price down / system error #E6EFEE | #E6EFEE | #0B2E33 | 12.35:1 | Text ≥4.5:1 |
| PROPOSAL | dark brass byline / emphasis / seal #C08B3E | #C08B3E | #061E21 | 5.76:1 | Text ≥4.5:1 |
| PROPOSAL | dark price up #26A8B1 | #26A8B1 | #061E21 | 6.02:1 | Text ≥4.5:1 |
| PROPOSAL | dark price down / system error #E6EFEE | #E6EFEE | #061E21 | 14.77:1 | Text ≥4.5:1 |
| Specified | light brass byline / emphasis / seal #88632C | #88632C | #F5F1E9 | 4.82:1 | Text ≥4.5:1 |
| Specified | light price up #14595E | #14595E | #F5F1E9 | 7.11:1 | Text ≥4.5:1 |
| Specified | light price down #0B2E33 | #0B2E33 | #F5F1E9 | 12.83:1 | Text ≥4.5:1 |
| Specified | light system error #14181A | #14181A | #F5F1E9 | 15.86:1 | Text ≥4.5:1 |
| Specified | light brass byline / emphasis / seal #88632C | #88632C | #FFFFFF | 5.43:1 | Text ≥4.5:1 |
| Specified | light price up #14595E | #14595E | #FFFFFF | 8.01:1 | Text ≥4.5:1 |
| Specified | light price down #0B2E33 | #0B2E33 | #FFFFFF | 14.45:1 | Text ≥4.5:1 |
| Specified | light system error #14181A | #14181A | #FFFFFF | 17.87:1 | Text ≥4.5:1 |
| Specified | light pass | #FFFFFF | #2E7D5B | 5.00:1 | Text ≥4.5:1 |
| Specified | light fail | #FFFFFF | #B3462F | 5.48:1 | Text ≥4.5:1 |
| Specified | light review on Sand | #B3462F | #F5F1E9 | 4.86:1 | Text ≥4.5:1 |
| Specified | light review on white | #B3462F | #FFFFFF | 5.48:1 | Text ≥4.5:1 |
| Specified | light insufficient on Sand | #5C6467 | #F5F1E9 | 5.37:1 | Text ≥4.5:1 |
| Specified | light insufficient on white | #5C6467 | #FFFFFF | 6.05:1 | Text ≥4.5:1 |
| Specified | dark pass | #0B2E33 | #3FAB7C | 5.04:1 | Text ≥4.5:1 |
| Specified | dark fail | #0B2E33 | #D9816E | 5.04:1 | Text ≥4.5:1 |
| Specified | dark review | #D9816E | #0B2E33 | 5.04:1 | Text ≥4.5:1 |
| Specified | dark insufficient | #919A9D | #0B2E33 | 5.03:1 | Text ≥4.5:1 |
| Specified | header Arabic name | #E0BC85 | #0B2E33 | 8.05:1 | Text ≥4.5:1 |
| Specified | header secondary text | #9FBAB9 | #0B2E33 | 7.02:1 | Text ≥4.5:1 |

## Arabic values requiring human review (119 leaves)
All values below start exactly with `⟦AR-REVIEW⟧ ` plus English, visible in the UI and isolated with English language/direction semantics. No machine translation or implied human approval. Supplied Arabic status labels still need the pre-launch reviewer confirmation requested by §7.1, but are not fabricated review-placeholder values. Deferred dictionary namespaces remain verbatim except prescribed brand/typo fixes and are exempt until used.

- `admin.addCriterion`
- `admin.auditEmpty`
- `admin.auditTrail`
- `admin.borderlineMargin`
- `admin.borderlineMarginHint`
- `admin.changelog`
- `admin.createMethodology`
- `admin.createVersion`
- `admin.criterionType`
- `admin.dataSnapshot`
- `admin.definitionField`
- `admin.demoData`
- `admin.demoNote`
- `admin.denominatorField`
- `admin.denominatorItems`
- `admin.denominatorItemsHint`
- `admin.edgeCases`
- `admin.enableProduction`
- `admin.formulaField`
- `admin.immutableNotice`
- `admin.label`
- `admin.licensingStatus`
- `admin.methodologyName`
- `admin.notes`
- `admin.numeratorField`
- `admin.numeratorItems`
- `admin.numeratorItemsHint`
- `admin.officialOrInspired`
- `admin.productionBlocked`
- `admin.productionBlockedShort`
- `admin.productionEnabled`
- `admin.prohibitedCategories`
- `admin.publisher`
- `admin.reloadDemo`
- `admin.reloadingDemo`
- `admin.scope`
- `admin.shortLabel`
- `admin.sortOrder`
- `admin.sourceReference`
- `admin.sourceTitle`
- `admin.sourceUrl`
- `admin.subtitle`
- `admin.threshold`
- `admin.thresholdDirection`
- `admin.thresholdUnit`
- `admin.title`
- `admin.treatmentCategories`
- `admin.treatmentCategoriesHint`
- `admin.treatmentRules`
- `admin.versionLabel`
- `admin.versionNumber`
- `banner.demo`
- `banner.exampleMethodology`
- `controls.coverage`
- `controls.dark`
- `controls.emptyBody`
- `controls.emptyTitle`
- `controls.fullDisclaimer`
- `controls.light`
- `controls.locale`
- `controls.skip`
- `controls.theme`
- `disclaimer.full`
- `disclaimer.short`
- `methodologies.adapted`
- `methodologies.borderline`
- `methodologies.changeHistory`
- `methodologies.definition`
- `methodologies.edgeCases`
- `methodologies.effectiveDate`
- `methodologies.formula`
- `methodologies.inProduction`
- `methodologies.internalExample`
- `methodologies.licensing`
- `methodologies.noChangeHistory`
- `methodologies.none`
- `methodologies.notInProduction`
- `methodologies.official`
- `methodologies.officialOrAdapted`
- `methodologies.productionStatus`
- `methodologies.publisher`
- `methodologies.requiredInputs`
- `methodologies.ruleGroups`
- `methodologies.rules`
- `methodologies.scope`
- `methodologies.sourceDocument`
- `methodologies.sourceRef`
- `methodologies.subtitle`
- `methodologies.title`
- `methodologies.treatment`
- `methodologies.verification`
- `methodologies.verificationDate`
- `methodologies.verifiedBy`
- `methodologies.version`
- `methodology.pageNote`
- `nav.screen`
- `styleguide.analyst`
- `styleguide.components`
- `styleguide.contrast`
- `styleguide.date`
- `styleguide.decorative`
- `styleguide.divider`
- `styleguide.emphasis`
- `styleguide.fonts`
- `styleguide.intro`
- `styleguide.labels`
- `styleguide.money`
- `styleguide.negative`
- `styleguide.number`
- `styleguide.outline`
- `styleguide.proposal`
- `styleguide.review`
- `styleguide.seal`
- `styleguide.surfaces`
- `styleguide.systemError`
- `styleguide.text`
- `styleguide.title`
- `styleguide.tokens`
- `styleguide.typography`

## Screenshot artifacts
- `generated-artifacts/styleguide/ar-dark.png`
- `generated-artifacts/styleguide/ar-light.png`
- `generated-artifacts/styleguide/en-dark.png`
- `generated-artifacts/styleguide/en-light.png`

Also attached under `generated-artifacts/playwright/` with axe JSON results; CI uploads `foundation-browser-checks`. Generated screenshots/results are ignored by Git and deployment packaging.

## Remaining founder review
- Derived semantic colors are proposals, not approved brand decisions.
- Foundation interface/disclaimer placeholders require human Arabic drafting and approval before launch; existing engine Arabic-review work remains separate.
- No methodology, real security, edition, legal content page, authentication or integration was implemented. Stop at Step 4.
