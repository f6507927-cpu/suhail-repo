# Step 7 — sourced financial data handoff

## Scope and safety

D-118 releases the earlier mapping-only hold for code and local verification.
No live Supabase migration, seed, import, setting change or deployment was run.
The universe remains empty until an admin explicitly adds a security. Fixture
issuers are tests, not launch seeds. Screening runs and public stock pages are
not implemented in this step.

## Mapping fixes

- Calculation version: **calc-2026.10.3**; historical engine versions remain
  supported and the engine's default/formulas/golden hashes are unchanged.
- D-116: present-component debt without `LongTermDebt` or
  `LongTermDebtNoncurrent` stays numeric, but is estimated/Estimated with exactly:
  `No long-term debt tag found; total may be incomplete — analyst to confirm`.
  No components still means unknown; incompatible selected components remain
  unknown. Zero long-term debt is present, not missing.
- D-117: `FinanceLeaseLiability` and `OperatingLeaseLiability` replace their
  current/noncurrent pairs when present. Direct totals are reported/Verified;
  fallback component sums are derived/Calculated. Leases never enter debt.
- JPM's latest 10-K was inspected from the **full** companyfacts download before
  editing. Its mapped debt is **64776000000 USD, estimated/Estimated**; its
  separate operating lease total is **9337000000 USD, reported/Verified**.
  The combined debt/lease tag is excluded. Six maturity-payment tags are
  reconciliation candidates only, not carrying-value substitutions.
- Full findings: `SEC_JPM_DEBT_REVIEW.md`.
  Final per-company values, states, tiers, notes, filing URLs, candidate coverage
  and tag deviations: `SEC_ANNUAL_MAPPING.md`.

## Final mapping table

| Line item | Candidates / calculation |
| --- | --- |
| total_revenue | Revenues → RevenueFromContractWithCustomerExcludingAssessedTax → RevenueFromContractWithCustomerIncludingAssessedTax → SalesRevenueNet |
| total_assets | Assets |
| total_equity | StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest → StockholdersEquity |
| interest_bearing_debt | LongTermDebt, otherwise present LongTermDebtNoncurrent + LongTermDebtCurrent; plus present ShortTermBorrowings + CommercialPaper; D-116 completeness guard |
| finance_lease_liabilities | FinanceLeaseLiability, otherwise present FinanceLeaseLiabilityCurrent + FinanceLeaseLiabilityNoncurrent |
| operating_lease_liabilities | OperatingLeaseLiability, otherwise present OperatingLeaseLiabilityCurrent + OperatingLeaseLiabilityNoncurrent |
| cash_and_equivalents | CashAndCashEquivalentsAtCarryingValue → CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents (estimated restricted-cash proxy) |
| interest_bearing_investments | ShortTermInvestments → MarketableSecuritiesCurrent → AvailableForSaleSecuritiesDebtSecuritiesCurrent; always estimated until filing-note confirmation |
| accounts_receivable | AccountsReceivableNetCurrent |
| net_income | NetIncomeLoss |
| operating_cash_flow | NetCashProvidedByUsedInOperatingActivities |
| shares_outstanding | Latest dei:EntityCommonStockSharesOutstanding, retaining its own source and as-of date |
| prior_year_revenue / prior_year_net_income | Matching previous annual span using the corresponding ordered revenue / income tags |
| market_cap | Manual sourced close × current shares, database decimal arithmetic, weakest tier and both input references; explicit unknown when shares unavailable |
| ebitda | Not ingested |

## Implemented

- `src/ingest/sec/ingest.ts`: authoritative ticker preview, Nasdaq/NYSE
  restriction, issuer/submission lookup and serial single-security ingestion.
  SEC waits/backoff do not hold the admin-role transaction lock.
- `src/lib/financial/{persistence,service,data,flags,contracts}.ts`: issuer/listing
  identities; filing sources; annual periods; idempotent immutable fact history;
  reason-required corrections; filing confirmation; retained/deduplicated incoming
  SEC alternatives; audited acceptance; segment CRUD and derived shares; manual
  prices and market cap; coverage/company edits; non-destructive universe removal.
- Protection is scoped to **company + period + line_item**. A new period ingests
  normally. Changed-since-correction compares incoming SEC value with the SEC
  baseline at correction, not merely with the analyst's corrected value.
  Accepting SEC demotes the correction and promotes the selected stored SEC fact
  atomically; future ordinary imports can update it.
- `src/ingest/prices/manual.ts`: manual PriceProvider and source/licence note;
  no licensed feed or live prices.
- `src/jobs/{ingest-sec,run-ingest-sec}.ts`: one configured batch per invocation,
  persisted stable cursor/counts/errors/timing, retry-safe resume and failure
  isolation. `pnpm build:jobs`; `node dist/jobs/ingest-sec.js --help`.
  To resume: `node dist/jobs/ingest-sec.js <recorded-job-id>`.
- Admin securities and ingestion pages, guarded server actions and
  `src/components/financial/FinancialAdmin.tsx`. All mutations cross
  `requireRole(["admin"])` and `withAdminAction`; editors inspect read-only.
  Jobs use the trusted app-role database boundary without fabricated sessions.

## Migration — generated, NOT applied live

`drizzle/0008_dusty_adam_warlock.sql` and its generated metadata add issuer CIK,
ingest timestamps/error, fact origin/protection/version/evidence identity and SEC
baseline reference, plus manual-price URL/source provenance. Existing public
column grants are not expanded. Applied migrations were not edited.

The live private financial pages need this migration before use. Applying it
requires a separate founder authorization and Supabase preflight; do not seed
or import fixtures as part of that work.

## Actual verification

| Check | Result |
| --- | --- |
| Typecheck / ESLint / logical CSS lint | Passed |
| Unit tests | 781 passed |
| Engine tests | 215 passed; 100% statement/branch/function/line coverage |
| PostgreSQL 17 integration | 169 passed, disposable loopback database only |
| Account/methodology/navigation/financial browser fixtures | 103 passed, managed Chromium |
| Main browser suite | 13 passed |
| Production web build, DB variables and certificate removed | Passed |
| Jobs bundle and `--help` smoke with no DB/SEC credentials | Passed (Node emits a harmless module-type detection warning) |

PostgreSQL tests explicitly order the empty-target bootstrap before suites that
migrate; each full run uses a fresh disposable cluster. New tests cover mapping
quality/refusals, preferred totals, exact decimal market cap, immutable amendment
history/idempotency, protected evidence/acceptance, new-period behavior, segments,
filing confirmation, job failure/checkpoint/resume, editor controls and every
main editing flow. No real SEC call is needed for routine tests.

## Arabic and live prerequisites

Existing approved Arabic is unchanged. New Step-7 UI/errors are intentionally
English `⟦AR-REVIEW⟧` placeholders, not invented Arabic. The regenerated review
sheet has **148 pending rows** (146 new phrases plus the two original O-7 legal
bodies); zero unresolved caller surfaces or unused keys. None were newly approved.

Authenticated financial UI was exercised through isolated fixtures, not a live
signed-in Supabase session. After separate migration approval, validate the real
admin workflow and deliberately add the founder's chosen first security. Operate
one ingest process at a time. No distributed limiter or multi-instance guarantee
is claimed. Raw-response archiving remains deferred.
