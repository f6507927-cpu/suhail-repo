# SEC launch mapping findings

## Boundary and result

Public SEC companyfacts for **all 15 affected issuers** and their latest annual
filings were retrieved serially through the existing process-local request budget
on **2026-10-22**. Full responses and HTML are temporarily in the ignored
`generated-artifacts/sec-launch/` directory. Genuine reduced fixtures, original
`.4` outputs, full-facts concept inventory and filing excerpts with URLs,
retrieval timestamps and SHA256 hashes are committed under
`tests/fixtures/sec/launch/`.

**No Supabase access—including reads—was made. No `setup:launch`, live ingest,
live migration/seed, deployment or hosted configuration change was run.**
Disposable loopback PostgreSQL tests are not a live import.

The founder's **24/25 live baseline** is a separate observation. The
[same-evidence local before/after table](SEC_LAUNCH_MAPPING.md#reproducible-comparison)
does not establish 25/25 live success.

### Local mapping changes (USD)

| Issuer/item | Old `.4` | New `.6` | Scope |
| --- | --- | --- | --- |
| AVGO interest proxy | unknown | 347,000,000 estimated/Estimated | `InterestIncomeOther`; filing's separate interest-income row |
| CSCO interest proxy | unknown | 866,000,000 estimated/Estimated | `InvestmentIncomeInterestAndDividend`; combined source, includes dividends |
| QCOM interest proxy | unknown | 639,000,000 estimated/Estimated | Same combined concept; dividends included as conservative precaution |
| HD interest proxy | unknown | 124,000,000 estimated/Estimated | Same combined concept; not pure interest |
| COST broader proxy | unknown | 711,000,000 estimated/Estimated | `InterestAndOtherIncome`; ancillary income and net adjustments, not gross prohibited income |
| AVGO net income | unknown | 23,126,000,000 reported/Verified | `ProfitLoss`, consolidated including noncontrolling interests |
| ORCL debt | unknown | 129,541,000,000 estimated/Estimated | Noncurrent notes 122,342,000,000 + current notes 7,199,000,000 |
| JNJ debt | unknown (incompatible historical commercial-paper instant) | 47,933,000,000 derived/Calculated | Noncurrent debt 39,438,000,000 + current loans/notes 8,495,000,000 |

Every proxy retains the incomplete-gross-income warning. Missing values stay
unknown, not zero. Negative candidates are never treated as gross income.
The full report lists exact periods, accessions, filed dates and both mapping
notes for every compared item, including unchanged/unresolved issuers.

## Why the four original annual interest candidates fail

All observations below are **USD**. Selected revenue years are valid annual
durations: AMD/PEP **364 inclusive days**, TXN/LLY **365**. No annual-selection
defect was demonstrated; 52/53-week duration is **not** the cause.

| Issuer | Selected period / latest annual filing (filed) | Actually observed `us-gaap:InvestmentIncomeInterest` | Why not compatible |
| --- | --- | --- | --- |
| AMD | 2024-12-29–2025-12-27; 0000002488-26-000018, 10-K, 2026-02-04 | Latest annual: 2013-12-29–2014-12-27, 3,000,000; 0001193125-15-054362, 10-K/FY, filed 2015-02-19. Latest any: 2014-12-28–2015-03-28, 0; 0001193125-15-156842, 10-Q/Q1, filed 2015-04-29 | Stale annual and a later stale quarter; neither matches the selected start/end |
| TXN | 2025-01-01–2025-12-31; 0000097476-26-000059, 10-K, 2026-02-06 | Latest annual/any: 2016-01-01–2016-12-31, 11,000,000; 0001564590-17-002142, 10-K/FY, filed 2017-02-23 | Stale year, not duration rejection |
| PEP | 2024-12-29–2025-12-27; 0000077476-26-000007, 10-K, 2026-02-03 | Latest annual: 2009-12-27–2010-12-25, 68,000,000; 0001193125-11-040427, 10-K/FY, filed 2011-02-18. Latest any: 2010-12-26–2011-06-11, 37,000,000; 0001193125-11-193147, 10-Q/Q2, filed 2011-07-21 | Stale annual and stale YTD; broader `InterestAndOtherIncome` is also historical only |
| LLY | 2025-01-01–2025-12-31; 0000059478-26-000013, 10-K, 2026-02-12 | Latest annual: 2024-01-01–2024-12-31, 175,200,000; 0000059478-25-000067, 10-K/FY, filed 2025-02-19. Latest any: 2025-01-01–2025-09-30, 153,300,000; 0000059478-25-000254, 10-Q/Q3, filed 2025-10-30 | Prior annual year and current-year nine-month YTD, not a compatible current annual amount |

The full inventory provides each source description, namespace, retrieval date
and original full-response hash. Filing inspection does not authorize broader
taxonomy expansion: AMD's current filing separately labels interest income
215 million but tags it with net-interest semantics; TXN's other-income row
includes interest, royalties, leases and tax interest. These are not silently
adopted as gross prohibited income.

Other unresolved interest gaps: **AAPL, MSFT and NFLX**. AAPL's combined tag
ends in FY2023; MSFT's ends in FY2013; NFLX's `InterestIncomeOperating` annual
evidence ends in FY2024. Their latest filings do not supply compatible values
under the approved candidates. For example MSFT discloses interest/dividends
3,301 million and NFLX discloses interest 295 million in current filing text,
but a textual disclosure is not automatically a companyfacts mapping. Any
analyst correction needs same-period source review, not stale-tag substitution.

## Debt evidence and overlap

ORCL FY2026, accession **0001193125-26-277521**, filed **2026-06-22**:
note 6's carrying table totals **129,541 million**, split into current
**7,199 million** (`NotesPayableCurrent`) and noncurrent **122,342 million**
(`LongTermNotesPayable`). Its table includes commercial paper **1,468 million**
and term borrowing; these must not be added again. The literal D-116 test is
unchanged: neither notes alias establishes `LongTermDebt`/`LongTermDebtNoncurrent`
completeness. Output retains exactly:
**No long-term debt tag found; total may be incomplete — analyst to confirm**.

JNJ FY2025, accession **0000200406-26-000016**, filed **2026-02-11**:
note 7 reports long-term debt **41,438 million**, comprising current **2,000**
and noncurrent **39,438**. Its **8,495 million** current loans/notes balance
(`ShortTermBorrowings`) already includes that current **2,000**. Adding the
long-term total to this balance would double count maturities. The compatible
sum is **39,438 + 8,495 = 47,933 million**. The `CommercialPaper` observation
of **3,600 million**, end **2024-05-15**, is an old issuance discharged in the
Kenvue exchange, not the FY2025 balance. The filing's current commercial paper
is described as approximately **6.5 billion**, already inside current loans.
`DebtCurrent` is lease-inclusive by taxonomy and is **not** adopted.

These additional filing-scope interpretations are deliberately keyed to the
verified CIK/accession. Future filings do not inherit them automatically.
Present selected components must remain filing-local, USD, and exact-end
instants; incompatible components make the sum unknown. No components means
unknown; numeric zero remains present. Maturity schedules, face amounts,
borrowing flows and lease-containing totals are excluded. The full report
lists the latest-filing debt concepts and balances, including rejected ones.

## AVGO net-income diagnosis

For **2024-11-04–2025-11-02**, accession **0001730168-25-000121**, 10-K filed
**2025-12-18**, no compatible `NetIncomeLoss` exists. Full companyfacts has
**no `NetIncomeLossAttributableToParent` concept**. It has compatible `ProfitLoss`
**23,126,000,000 USD**, supported by the actual consolidated statements and
net-income-per-share reconciliation. The fallback is consolidated profit
including noncontrolling interests, not a claim of parent-attributable scope.
This explicit source-scope note also travels with comparative net income.

## XOM: reproduced paths, not an invented original cause

Public retrieval and pure mapping succeed for **2025-01-01–2025-12-31**,
accession **0000034088-26-000045**, filed **2026-02-18**. The captured `.4`
mapping persists successfully on disposable PostgreSQL; the actual current
`ingestSecurity → mapAnnual → persistAnnual` path also succeeds using captured
SEC transport. Repeated imports are idempotent and preserve protected analyst
corrections. Local launch-evidence checks use explicitly synthetic test price
inputs, not the founder's original launch row.

No original XOM failing log/exception or failing stage is available in this
workspace. The generic ingestion error does not distinguish retrieval, mapping,
persistence or launch-evidence application, and is not proof of a defect in any
one stage. **The original live XOM failure is not reproduced or claimed fixed.**
Missing evidence is the original sanitized failing stage and reproducible
same-run inputs/period (without credentials, database errors/bodies, connection
strings or personal information). Public errors remain sanitized; no raw error
logging or diagnostic bypass was added.

## Provenance, commands and validation

- New SEC mapping and current screening default: **calc-2026.10.6**.
- Historical **calc-2026.10.1–.5** remain accepted and replayable under both
  supported engines. Historical engine golden hashes are unchanged.
- **engine-1.0.2** and market-value derivation **calc-2026.10.5** are unchanged.
- Full captures: `node --conditions=react-server --import tsx scripts/sec/capture-launch.ts`
  (original `.4` execution before edits), and `scripts/sec/capture-filings.ts`
  with the same Node flags. These public-only scripts never import a DB client.
- Baseline reduction: `node --import tsx scripts/sec/prepare-launch-fixtures.ts`
  on original `.4` code; refuses to replace historical fixtures on newer code.
- Full-capture offline report: `node --import tsx scripts/sec/launch-mapping-report.ts`;
  compares old reference rules to preserved baseline and new full/reduced results.
- Filing excerpts: `node --import tsx scripts/sec/extract-filing-evidence.ts`.
### Final checks (2026-10-22)

| Command / check | Result |
| --- | --- |
| `pnpm test` | **74 files, 1,215 tests passed**, including SEC/client/financial/launch tests and old/new stored screening replay |
| `pnpm test:engine` | **7 files, 226 tests passed; 100% statements/branches/functions/lines**. Historical golden hashes retained |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed |
| `pnpm lint:logical` | Passed |
| `env -u DATABASE_URL_TEST pnpm db:test:up` | Started an owned disposable PostgreSQL 17 cluster on loopback only |
| `env -u DATABASE_URL_TEST pnpm exec vitest run --config vitest.database.config.ts tests/sec-launch.integration.test.ts tests/financial.integration.test.ts tests/launch.integration.test.ts tests/screening.integration.test.ts tests/stock.integration.test.ts` | **5 files, 49 tests passed**, sequential; includes all 15 actual issuer ingest paths, repeated imports, retained analyst corrections, XOM local launch evidence, and current `.6` stored-run integration |
| Full/reduced mapping comparison + filing-excerpt generation | Passed for all 15 issuer captures; original `.4` and current `.6` use identical captured facts |
| `git diff --check` | Passed |
| Restarted development workflow; browser request to database-free `/api/health` | **HTTP 200**, `status: ok`; no workflow crash. No database-backed page or signed-in UI was visited or verified |

Detailed local check output is under ignored `generated-artifacts/sec-*.log`.
The first native/pnpm public-fetch attempt exposed a certificate-store difference;
native Node captured SEC evidence with TLS verification intact. No rate-limit,
database, credentials or TLS-security setting was loosened.

Stop here for the founder's separately authorized `setup:launch` rerun. There is
no automatic launch, live database probe or live-success promise.
