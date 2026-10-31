# Step 3 — deterministic screening engine

## Scope and public API

Implemented only the pure engine. No database access, writes, migrations, adapters,
UI, authentication, ingestion, jobs, AI, purification or production methodology
enablement were added. The founder-owned reference is unchanged.

Public module: `src/engine/index.ts` (also available as `@/engine`).

```ts
screen(input: EngineInput): EngineResult
verify(payload: JsonValue, storedHash: string): boolean
```

Also exports the standalone types, `EngineInputError`, `canonicalize`, version
constants, `renderEnglish` and `renderArabicDraft`. Malformed contracts throw
`EngineInputError`; real evidence gaps return structured unknowns. No result is
returned on invalid input. The future screening service must catch that error.

`EngineResult` includes criterion evidence, unknowns, structured status reasons,
status/quality, the exact canonical `hashPayload`, `immutableHash` and synthetic
`financialSnapshotId`. Verification never retrieves live evidence.

The contract is camelCase and independent of database types. Conversion to the
database's snake_case reason shape, including counts, belongs to a later adapter.

## Files changed

- `.gitignore`: ignore `attached_assets/`.
- Git index: untrack the Step 1/2 uploads without removing local copies. The
  current Step 3 upload is also ignored. All three uploads remain accessible;
  `git ls-files attached_assets/` is empty. No history was rewritten.
- `docs/DECISIONS.md`: four initial approved rows, then six clarification rows.
- `src/engine/types.ts`, `versions.ts`, `index.ts`: standalone contract/API.
- `src/engine/validate.ts`: typed malformed-contract errors using existing Zod.
- `src/engine/evidence.ts`: used evidence, distinct states/sources, weakest tier.
- `src/engine/math.ts`: decimal half-away rounding and exact margin distances.
- `src/engine/evaluators.ts`: six registered evaluators and blocking fallback.
- `src/engine/screen.ts`: supplied-date freshness, precedence and quality.
- `src/engine/canonical.ts`, `payload.ts`: D-89's evidence-complete projection,
  SHA-256 and independent historic verification.
- `src/engine/reasons/structured.ts`, `en.ts`, `ar.ts`: structured reasons and
  separate locale renderers. Every Arabic draft starts with `⟦AR-REVIEW⟧`, with
  `AR-REVIEW: needs human Arabic drafting` beside every template.
- `src/engine/__fixtures__/synthetic.ts`, `evidence.ts`: obviously fake EX-A/EX-B
  companies and D-90's five additional EX-A evidence cases.
- `src/engine/evaluation.test.ts`, `contract.test.ts`, `hash.test.ts`, `completeness.test.ts`,
  `reasons.test.ts`: exhaustive engine tests.
- `src/engine/__snapshots__/hash.test.ts.snap`, `completeness.test.ts.snap`:
  thirteen committed golden cases. All eight original hashes were regenerated
  for the expanded D-89 format; five new cases include the full canonical payload.
- `tests/import-boundaries.test.ts`, `eslint.config.mjs`: enforce pure-engine
  imports and reject IO, environment access, clock reads and randomness.
  Cold ESLint startup has a separate setup budget; assertion timeouts are unchanged.
- `vitest.engine.config.ts`, `package.json`, `pnpm-lock.yaml`: focused engine
  coverage command and the development-only property-testing dependency.
- `.github/workflows/ci.yml`: separate engine coverage job with **no database
  service or database environment variables**; existing CI scope remains intact.
- `.agents/memory/MEMORY.md`, `validation-startup-budgets.md`: record why concurrent
  completion checks need a separate cold-tooling startup budget.

No migrations or schema changes.

## Verification and coverage

All required checks passed:

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm lint:logical` | Pass |
| `pnpm test` | 280 tests across 11 files passed |
| `pnpm test:engine` | 186 tests across 5 files passed |

V8 production-engine coverage:

| Metric | Covered / total | Coverage |
| --- | --- | --- |
| Branches | 202 / 202 | 100% |
| Statements | 285 / 285 | 100% |
| Functions | 104 / 104 | 100% |
| Lines | 228 / 228 | 100% |

Every executable production module is included. Only tests and synthetic fixtures
are excluded; no production branch is hidden. Type-only/export-only modules have
no executable branches. Per-file branch thresholds are 100%.

Generated report: `coverage/engine/index.html`; machine-readable summaries:
`coverage/engine/coverage-summary.json` and `coverage/engine/coverage-final.json`.
Generated coverage remains ignored by Git. CI uploads the report as an artifact.

The existing Next workflow started cleanly; the unchanged `/` page returned 200
and was visually checked. No engine UI was added. Vitest prints its existing
future-config-loader compatibility warning; it does not fail the checks.

## Test-case inventory

- Max/min equality, pass/fail; boolean and null threshold; positive, zero and
  negative values; borderline on both sides and exact threshold; null margin.
- Half-away decimal ties (positive/negative), tiny/exponential numbers, negative
  zero normalization; comparisons use rounded ratios without re-rounding
  thresholds or margins. All five threshold units and deterministic traces.
- All four ratio evaluator types; exhaustive configured sums; missing/unknown
  numerators and denominators; both unavailable together; denominator zero and
  negative with the exact D-79 explanation; fail outranks blocking unknown.
- Prohibited/permissible/unclassified primary activity; no disclosure; neither
  share nor amount disclosed; share-only evidence; derived shares; unavailable
  amounts and nonpositive segment totals; unknown-state numeric evidence.
- Prohibited primary ties (including a tied unclassified segment) use the exact
  D-80 review explanation and never fail solely for the tie; all-permissible
  ties pass; unclassified primary review handling remains.
- Non-permissible revenue pass/fail/borderline, unclassified/missing amounts,
  unknown-state segments, no segments, missing total revenue, and exhaustive
  category evidence even for permissible segments.
- Unregistered evaluator names, including inherited-object-key names, block.
- 550/551-day boundaries; custom limit; supplied-date determinism under changed
  system clocks; frozen inputs; staleness with failure/blocking/unknown evidence.
- Adequacy/confidence matrix; missing lowers quality per D-88; state versus tier
  distinction; all weakest-tier pairs, including combined fact/segment evidence;
  unused-fact and descriptive `requiredInputs` isolation; all supplied segments
  still affect quality.
- Structured reason counts and precedence, all six locale template kinds, every
  English reason code, null/absolute/boolean rendering, marked Arabic drafts.
- Recursive code-point keys (including astral characters), undefined/null,
  ten-decimal precision and negative zero; sorted fact/segment arrays versus
  preserved criterion/line-item/treatment arrays; exact payload field allowlists.
- Valid/tampered hash verification, stored JSON roundtrips, changes to live facts
  do not prevent historic verification, synthetic snapshot IDs.
- Eight original golden snapshots: all four statuses under both fabricated methodologies,
  with hashes, projected criteria and calculated outputs. Wider EX-B categories,
  cash-only numerator and explicit lease isolation are checked.
- Five additional EX-A snapshots (D-90): prohibited primary, estimated investment,
  551-day stale period, missing investment numerator, and prohibited primary tie.
  The tie uses 25 equal 4% segments with one prohibited category: NPR passes at
  4%, leaving the tie itself as the cause of review rather than a 50% revenue fail.
- D-89 hash regression inventory: individual segment tiers, criterion labels,
  definitions, source references and sort order; dates and methodology/period
  labels; freshness unknowns masked by fail/blocking precedence; full stored
  criterion evidence, unknown and structured-reason projection; unchanged default
  resolution; historic `engine-1.0.0` verification against its original hash;
  sub-canonical number changes that alter stored trace text.
- Three fast-check properties, 150 generated cases each: object-key and arbitrary
  fact/segment-order permutations preserve hashes; every single fact value/state/
  tier/source mutation changes hashes; generated stored payloads always verify.
  Mutation values remain distinguishable at canonical precision. Criterion and
  nested arrays are deliberately not subject to an invariance claim.
- Invalid-contract inventory: duplicate evidence keys/criterion IDs, malformed
  dates, non-finite values (also nested treatment JSON), invalid staleness limits,
  missing required metadata/tiers, invalid enums/category lists, empty ratio
  lists and known-state null facts. All throw `EngineInputError`.

## Decisions applied and dependencies

- D-11: use supplied methodology version/criteria; no methodology mutation.
- D-13/D-61: undisclosed/unclassified primary activity is review, not blocking.
- D-42/D-59: structured reasons; render only at display time.
- D-43: return the exact canonical projection for independent future storage.
- D-44/D-62: leases remain separate; only explicit line-item lists include them,
  never EX-B fixture treatment prose alone.
- D-79–D-82: nonpositive denominators, primary ties, required segment tiers,
  and local-preserving upload hygiene. D-89 supersedes the original tier exclusion.
- D-83–D-88: typed invalid contracts, unknown-state numeric unavailability,
  non-derivable shares, empty evidence, metadata-only required inputs, and missing
  quality/null-fact contradictions.
- D-89–D-90: evidence-complete hashing and the five requested EX-A golden cases.

Only **fast-check** was added, as a development dependency, to generate and shrink
permutation, mutation and verification counterexamples. Existing Zod validates the
runtime contract; existing Vitest/V8 provide tests and coverage. No new runtime
dependency was added.

The engine version advances from `engine-1.0.0` to `engine-1.0.1` for the expanded
hash format. `calc-2026.10.1` is unchanged because no calculation rules or
thresholds changed. Future calculation rule changes must bump calculation version.

## D-89 input-completeness audit

The founder-approved override is recorded in the decision log; the founder-owned
reference itself is not edited. Canonicalization still rounds numbers to ten
decimals, normalizes negative zero, and preserves non-prescribed array order.

| Input group | Hash coverage and gaps fixed |
| --- | --- |
| Security and versions | IDs and engine/calculation versions were already covered. |
| Facts | Every field was already covered; facts remain sorted by line item. |
| Segments | Added `confidence_tier` to the existing six fields; segments remain sorted by name. Even a non-weakest tier change now changes the hash. |
| Freshness | Added `as_of`, resolved `staleness_limit_days` (550 when omitted) and `financial_period_end`; these can change stored unknowns even when final status/quality are unchanged. |
| Snapshot labels | Added methodology-version and financial-period labels, which are screening-run snapshot metadata. |
| Criteria | Added label, numerator/denominator definitions, source reference and sort order; these change criterion evidence, traces, unknown fields or reasons. Existing operational fields remain covered. |
| Derived output evidence | Added all criterion evidence fields, unknowns and structured status reasons, retaining the original aggregate/result/value fields. Hash/snapshot ID are derived afterward to avoid self-reference. |
| Descriptive-only criterion metadata | `definition`, `formulaText`, `treatmentRules`, `edgeCases`, `requiredInputs`, `effectiveDate` and `notes` do not change stored engine outputs; they remain outside the hash, with an explicit no-output-change regression test. `effectiveDate` is validated but not evaluated. |

No further output-affecting input omissions were found in the current engine
contract. Stored-payload verification is version-independent: an old EX-A payload
still verifies against its original committed hash, without live evidence.

## Remaining founder questions

The six execution-contract questions are resolved in D-83–D-88; no silent
substitute rules were introduced. Remaining reference questions are governance
and approved copy, not authorization to enable a production methodology:

1. **§7.3 / O-3:** Who will write and approve the final Arabic templates, and what
   exact wording should replace each visibly marked draft?
2. **§7.5 / O-1:** Which verified Al Rajhi / Awaied rules, including explicit
   numerator/denominator and lease treatment, should the first production
   methodology version use after gate G1?

Step 3 stops here. Persistence, job handling of `EngineInputError`, reason-shape
adapters, accounts and later numbered steps are not implemented.
