# SEC annual mapping — founder review checkpoint

> Historical mapping checkpoint. The current, full-companyfacts launch investigation
> and calc-2026.10.6 changes are documented in [SEC_LAUNCH_FINDINGS.md](SEC_LAUNCH_FINDINGS.md)
> and [SEC_LAUNCH_MAPPING.md](SEC_LAUNCH_MAPPING.md). Original evidence below is retained,
> not rewritten as if the new candidates had been present in these older samples.

**D-118: founder go-ahead received for the remainder of Step 7.**
This report describes the pure mapping and its committed evidence. Continuation code is development-only until separately migrated. No live imports, Supabase writes or seeds were run. The universe remains empty. Test issuers are not launch selections. Screening formulas and Arabic-copy approvals are unchanged.

## Selection and provenance contract

- Annual evidence: 10-K/10-K/A, fp FY, USD duration of 350–380 inclusive days (52/53-week years included). Choose latest observation end, then latest filed/accession; choose the modal annual start in that filing, lexical start on a tie. Quarterly/YTD observations cannot anchor an annual period.
- `fy` belongs to the filing. Never select a comparative by matching its `fy`. Direct facts take the latest actual annual filing of the exact period: USD annual durations or period-end instants. An unchanged direct fact can therefore cite the original 10-K when a sparse amendment omits it. Sums stay confined to the selected accession. No stale fallback from other periods. Candidate order stays as supplied.
- Comparatives use the immediately preceding period ending the day before the selected annual start, matching its actual annual start/end, latest filed/accession per candidate. DEI shares use the latest valid shares instant in 10-K/10-K/A/10-Q/10-Q/A, then latest filed/accession. Each cites its own filing.
- Equal filed dates use descending accession then form; equal usable observations use lexical start/tag and ascending value. Alternate units never displace a compatible USD/shares observation. If only incompatible selected sum components exist, the entire sum is unknown, not a partial known total.
- Sums use only present components in the selected accession. D-116: debt without LongTermDebt or LongTermDebtNoncurrent is estimated/Estimated, with the founder's incompleteness note. Zero is present. Absent tags never become assumed-zero facts. D-117: each lease total replaces its pair and is reported/Verified; fallback sums are derived/Calculated. Leases remain excluded from debt.
- Unknown facts use null/unknown and the weakest non-AI tier Estimated (not a claim that a value was estimated); unknown_note states the gap. Known direct facts are reported/Verified except the investments, restricted-cash and prohibited-income proxies, which are estimated/Estimated; sums are derived/Calculated.
- Source fields are persistence-ready but have no fabricated database IDs. All source columns identify SEC EDGAR, regulatory_filing, form/year, accession, filing-index URL, filed/retrieved dates and filing reporting period. Real downloads are non-synthetic/non-demo; synthetic evidence stays production-blocked.

## Version coordination (D-06)

Mapping calculation_version: **calc-2026.10.4**. New runs use engine-1.0.2 and this calculation version. Historical engine-1.0.1 replay retains rounded comparisons, ten-decimal canonicalization and its original golden hashes; calculation versions .1–.3 remain supported. New decisions compare unrounded ratios; new payload numbers retain full JS precision for replay. Persistence records each fact's version. No methodology, editorial default or production gate is changed.

## SEC request budget and future execution boundary

The server-only client has one shared process-global token bucket across all SecClient instances and every retry: capacity one, refill one token per 125 ms. This intentionally prevents bursts: at most eight starts in any half-open rolling 1000 ms window. FIFO acquisition and fake-timer tests cover concurrent instances, all endpoints and retries. A request timeout (default 15 s; maximum 60 s) covers headers and JSON body. 429/5xx retry at most three times by default (configurable 0–5), capped exponential backoff with 50–100% jitter, maximum delay 8 s. Other statuses, invalid JSON, network errors and timeouts fail explicitly; redirects are refused. SEC_USER_AGENT is obtained lazily on the server and never recorded in the report.

**D-118: operate one ingest at a time in one JavaScript process.** Admin and job ingestion share the client and in-process serialization queue. Run one ingest process, not overlapping CLI/web-worker imports. The CLI processes one configured batch; resume using its recorded job ID. There is no distributed limiter or fleet-wide request-budget guarantee.

## Fixture retrieval

### AAPL — Apple Inc.

- Companyfacts: https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json
- Retrieved: 2026-10-16T11:08:37.822Z; synthetic=false; demo=false
- Full downloaded JSON SHA-256 (serialized retrieval): 73a86c6aedc31f77cac2ea4df5f80f0b3bd7e6eb58bb4e01444fbedf3afb9c43
- Trimming: Requested mapping tags plus RevenuesNetOfInterestExpense; all units/forms with end >= 2022-01-01; observations copied unchanged. An empty units object means the original concept exists only outside the retained window.

### MSFT — MICROSOFT CORPORATION

- Companyfacts: https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json
- Retrieved: 2026-10-16T11:08:38.393Z; synthetic=false; demo=false
- Full downloaded JSON SHA-256 (serialized retrieval): f8aae2965b20ad0df44bdf7ccbedf797d275b6b8dc030154a7a311361bb7246f
- Trimming: Requested mapping tags plus RevenuesNetOfInterestExpense; all units/forms with end >= 2022-01-01; observations copied unchanged. An empty units object means the original concept exists only outside the retained window.

### JPM — JPMORGAN CHASE & CO

- Companyfacts: https://data.sec.gov/api/xbrl/companyfacts/CIK0000019617.json
- Retrieved: 2026-10-16T11:08:39.082Z; synthetic=false; demo=false
- Full downloaded JSON SHA-256 (serialized retrieval): ded1884952751a50387a9675bf9476df51f416b431bf489c95fda9ad6dc520fe
- Trimming: Requested mapping tags plus RevenuesNetOfInterestExpense; all units/forms with end >= 2022-01-01; observations copied unchanged. An empty units object means the original concept exists only outside the retained window.

### MISSING — SYNTHETIC MISSING TAGS — NOT A REAL ISSUER

- Companyfacts: synthetic:missing-tags
- Retrieved: 2026-10-16T00:00:00.000Z; synthetic=true; demo=true
- Full downloaded JSON SHA-256 (serialized retrieval): not applicable — explicitly synthetic
- Trimming: Clearly synthetic annual anchor only; all requested candidates deliberately absent.

Downloads succeeded for all three real fixtures. No real-company values were fabricated. Raw downloads are temporary local retrieval inputs, not a raw-response archive. The committed JSON retains original observation values, units, dates, accession/filed metadata, prior years and quarterly distractors. Reproduce trimming with `pnpm exec tsx scripts/sec/trim-fixtures.ts <temporary-download-directory>`; generate this report with `pnpm exec tsx scripts/sec/mapping-report.ts`.

## Candidate inventory and every deviation

D-117 adds the two preferred lease totals before their existing component pairs. D-124 adds only the genuinely verified InvestmentIncomeInterest annual candidate as an estimated prohibited-income proxy. Other supplied candidate ordering is unchanged. No combined debt/lease or maturity-schedule proxy was added. The inventory lists every mapping candidate. Counts are **compatible selected-filing observations** (DEI: the shares observation's own filing/as-of date); 0 means unverified in that selected filing.

| Line item | Candidate / component | AAPL | MSFT | JPM | MISSING |
| --- | --- | ---: | ---: | ---: | ---: |
| total_revenue | Revenues | 0 | 0 | 1 | 0 |
| total_revenue | RevenueFromContractWithCustomerExcludingAssessedTax | 1 | 1 | 0 | 0 |
| total_revenue | RevenueFromContractWithCustomerIncludingAssessedTax | 0 | 0 | 0 | 0 |
| total_revenue | SalesRevenueNet | 0 | 0 | 0 | 0 |
| prohibited_income | InvestmentIncomeInterest | 0 | 0 | 1 | 0 |
| total_assets | Assets | 1 | 1 | 1 | 0 |
| total_equity | StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest | 0 | 0 | 0 | 0 |
| total_equity | StockholdersEquity | 1 | 1 | 1 | 0 |
| interest_bearing_debt | LongTermDebt | 1 | 1 | 0 | 0 |
| interest_bearing_debt | LongTermDebtNoncurrent | 1 | 1 | 0 | 0 |
| interest_bearing_debt | LongTermDebtCurrent | 1 | 1 | 0 | 0 |
| interest_bearing_debt | ShortTermBorrowings | 0 | 0 | 1 | 0 |
| interest_bearing_debt | CommercialPaper | 1 | 0 | 0 | 0 |
| finance_lease_liabilities | FinanceLeaseLiability | 1 | 1 | 0 | 0 |
| finance_lease_liabilities | FinanceLeaseLiabilityCurrent | 1 | 0 | 0 | 0 |
| finance_lease_liabilities | FinanceLeaseLiabilityNoncurrent | 1 | 0 | 0 | 0 |
| operating_lease_liabilities | OperatingLeaseLiability | 1 | 1 | 1 | 0 |
| operating_lease_liabilities | OperatingLeaseLiabilityCurrent | 1 | 0 | 0 | 0 |
| operating_lease_liabilities | OperatingLeaseLiabilityNoncurrent | 1 | 1 | 0 | 0 |
| cash_and_equivalents | CashAndCashEquivalentsAtCarryingValue | 1 | 1 | 0 | 0 |
| cash_and_equivalents | CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents | 1 | 1 | 1 | 0 |
| interest_bearing_investments | ShortTermInvestments | 0 | 1 | 0 | 0 |
| interest_bearing_investments | MarketableSecuritiesCurrent | 1 | 0 | 0 | 0 |
| interest_bearing_investments | AvailableForSaleSecuritiesDebtSecuritiesCurrent | 0 | 0 | 0 | 0 |
| accounts_receivable | AccountsReceivableNetCurrent | 1 | 1 | 0 | 0 |
| net_income | NetIncomeLoss | 1 | 1 | 1 | 0 |
| operating_cash_flow | NetCashProvidedByUsedInOperatingActivities | 1 | 1 | 1 | 0 |
| shares_outstanding | dei:EntityCommonStockSharesOutstanding | 1 | 1 | 1 | 0 |

- **D-124 genuine interest evidence:** read-only companyfacts retrieval on 2026-10-16 verified JPM InvestmentIncomeInterest: 28,032,000,000 USD, 2025-01-01–2025-12-31, 10-K FY2025, accession 0001628280-26-008131, filed 2026-02-13. The concept describes interest income on nonoperating securities before discount/premium accretion/amortization. This is NOT complete gross prohibited income: untagged interest, prohibited-activity revenue and other income require analyst review. Always estimated/Estimated even though the underlying tag is reported. AAPL and MSFT have no compatible candidate; combined interest/dividend concepts were inspected but NOT enabled. Absent, negative or incompatible annual candidates stay unknown.
- **Added explicit spelling, not a new financial category:** the attachment left the broader restricted-cash tag unnamed. It is `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents`; used only after ordinary cash fails and always with an estimated/restricted-cash caveat. Availability is above; synthetic tests exercise the fallback when ordinary cash is missing.
- **D-117 preferred totals:** `FinanceLeaseLiability` and `OperatingLeaseLiability` precede and replace their respective current/noncurrent pairs. Direct totals are reported/Verified. If absent, the existing present-component sum is used; no total and pair double counting.
- **Added explicit spellings for supplied lease sums:** `FinanceLeaseLiabilityCurrent`, `FinanceLeaseLiabilityNoncurrent`, `OperatingLeaseLiabilityCurrent`, `OperatingLeaseLiabilityNoncurrent`. Evidence availability is above. Lease liabilities are never folded into debt.
- **D-116 JPM debt completeness:** no LongTermDebt or LongTermDebtNoncurrent exists in the selected filing. Retain ShortTermBorrowings, but mark estimated/Estimated with the exact incompleteness note. Full-download candidate inspection, before edits, is recorded in docs/SEC_JPM_DEBT_REVIEW.md. No lease-inclusive or maturity tag was added.
- **Debt replacement/exclusions:** LongTermDebt replaces the entire LongTermDebtNoncurrent + LongTermDebtCurrent pair when present in the selected filing. Exclusions are recorded separately from absences in each mapping row below. ShortTermBorrowings and CommercialPaper remain additional components. No operating/finance leases, deposits, total-liability proxies or other unrequested borrowing tags were added.
- **JPM non-standard revenue evidence:** the sample includes RevenuesNetOfInterestExpense as an inspection-only candidate. It is NOT added to the supplied candidate order. JPM also reports Revenues for the selected period, so the supplied first candidate suffices. The alternate tag is not verification of an issuer where only a bank-specific revenue tag exists; such a tag-only issuer would remain unknown under this config. No financing/sector/activity inference is made from it.
- **Unverified candidates:** every zero-count cell above is an unavailable compatible sample for that issuer. In particular, no claim is made that unexercised revenue/equity/investment alternatives are verified by these fixtures. Their deterministic mechanics are covered synthetically, which is not real-company verification.
- **Prior-year additions:** prior_year_revenue and prior_year_net_income reuse exactly the supplied revenue and income candidates, selecting true preceding dates, not comparative fy metadata.
- **Excluded as requested:** EBITDA, market_cap and prices are not mapped; no estimated debt components, assumed-zero facts, segment/SIC classifications, launch seeds or analyst confirmations are invented.

## Complete per-fixture mapping tables

Each mapping note lists tags actually used with **raw component values**, distinct from the mapped total. Values are absolute units, not millions. The filing column includes each fact's actual accession, filed date, source document and reporting period; shares as-of and comparative dates may differ from the selected annual period.

### AAPL — FY2025

Selected annual period: **2024-09-29 → 2025-09-27**; USD; filing **0000320193-25-000079**, filed **2025-10-31**.
Selected filing: https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html

| Line item | Mapped value / units | Input state | Confidence tier | Tags actually used, components, absences and mapping note | As of | Actual filing evidence |
| --- | ---: | --- | --- | --- | --- | --- |
| total_revenue | 416161000000 USD | reported | Verified | RevenueFromContractWithCustomerExcludingAssessedTax = 416161000000 USD; 2024-09-29 to 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| prohibited_income | null USD | unknown | Estimated | No XBRL value among: InvestmentIncomeInterest | 2025-09-27 | none — no sourced observation |
| total_assets | 359241000000 USD | reported | Verified | Assets = 359241000000 USD; instant 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| total_equity | 73733000000 USD | reported | Verified | StockholdersEquity = 73733000000 USD; instant 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| interest_bearing_debt | 98657000000 USD | derived | Calculated | Used: LongTermDebt = 90678000000 USD, CommercialPaper = 7979000000 USD; Absent in selected filing: ShortTermBorrowings; Alternative excluded: LongTermDebtNoncurrent, LongTermDebtCurrent; finance and operating lease liabilities excluded (D-44) | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| finance_lease_liabilities | 1230000000 USD | reported | Verified | Used: FinanceLeaseLiability = 1230000000 USD; Absent in selected filing: none; Alternative excluded: FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| operating_lease_liabilities | 12490000000 USD | reported | Verified | Used: OperatingLeaseLiability = 12490000000 USD; Absent in selected filing: none; Alternative excluded: OperatingLeaseLiabilityCurrent, OperatingLeaseLiabilityNoncurrent | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| cash_and_equivalents | 35934000000 USD | reported | Verified | CashAndCashEquivalentsAtCarryingValue = 35934000000 USD; instant 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| interest_bearing_investments | 18763000000 USD | estimated | Estimated | MarketableSecuritiesCurrent = 18763000000 USD; instant 2025-09-27; interest-bearing status unproven until analyst confirms filing notes (D-06) | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| accounts_receivable | 39777000000 USD | reported | Verified | AccountsReceivableNetCurrent = 39777000000 USD; instant 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| net_income | 112010000000 USD | reported | Verified | NetIncomeLoss = 112010000000 USD; 2024-09-29 to 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| operating_cash_flow | 111482000000 USD | reported | Verified | NetCashProvidedByUsedInOperatingActivities = 111482000000 USD; 2024-09-29 to 2025-09-27 | 2025-09-27 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| shares_outstanding | 14594180000 shares | reported | Verified | dei:EntityCommonStockSharesOutstanding = 14594180000 shares; cover-page as-of 2026-07-17 | 2026-07-17 | [0000320193-26-000020](https://www.sec.gov/Archives/edgar/data/320193/000032019326000020/0000320193-26-000020-index.html); 10-Q 2026; filed 2026-07-31; reporting 2026-06-27 |
| prior_year_revenue | 391035000000 USD | reported | Verified | RevenueFromContractWithCustomerExcludingAssessedTax = 391035000000 USD; 2023-10-01 to 2024-09-28 | 2024-09-28 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |
| prior_year_net_income | 93736000000 USD | reported | Verified | NetIncomeLoss = 93736000000 USD; 2023-10-01 to 2024-09-28 | 2024-09-28 | [0000320193-25-000079](https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.html); 10-K 2025; filed 2025-10-31; reporting 2025-09-27 |

### MSFT — FY2026

Selected annual period: **2025-07-01 → 2026-06-30**; USD; filing **0001193125-26-323660**, filed **2026-07-29**.
Selected filing: https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html

| Line item | Mapped value / units | Input state | Confidence tier | Tags actually used, components, absences and mapping note | As of | Actual filing evidence |
| --- | ---: | --- | --- | --- | --- | --- |
| total_revenue | 331839000000 USD | reported | Verified | RevenueFromContractWithCustomerExcludingAssessedTax = 331839000000 USD; 2025-07-01 to 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| prohibited_income | null USD | unknown | Estimated | No XBRL value among: InvestmentIncomeInterest | 2026-06-30 | none — no sourced observation |
| total_assets | 758376000000 USD | reported | Verified | Assets = 758376000000 USD; instant 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| total_equity | 442387000000 USD | reported | Verified | StockholdersEquity = 442387000000 USD; instant 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| interest_bearing_debt | 40294000000 USD | derived | Calculated | Used: LongTermDebt = 40294000000 USD; Absent in selected filing: ShortTermBorrowings, CommercialPaper; Alternative excluded: LongTermDebtNoncurrent, LongTermDebtCurrent; finance and operating lease liabilities excluded (D-44) | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| finance_lease_liabilities | 66594000000 USD | reported | Verified | Used: FinanceLeaseLiability = 66594000000 USD; Absent in selected filing: none; Alternative excluded: FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| operating_lease_liabilities | 21925000000 USD | reported | Verified | Used: OperatingLeaseLiability = 21925000000 USD; Absent in selected filing: none; Alternative excluded: OperatingLeaseLiabilityCurrent, OperatingLeaseLiabilityNoncurrent | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| cash_and_equivalents | 20935000000 USD | reported | Verified | CashAndCashEquivalentsAtCarryingValue = 20935000000 USD; instant 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| interest_bearing_investments | 55908000000 USD | estimated | Estimated | ShortTermInvestments = 55908000000 USD; instant 2026-06-30; interest-bearing status unproven until analyst confirms filing notes (D-06) | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| accounts_receivable | 80876000000 USD | reported | Verified | AccountsReceivableNetCurrent = 80876000000 USD; instant 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| net_income | 133749000000 USD | reported | Verified | NetIncomeLoss = 133749000000 USD; 2025-07-01 to 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| operating_cash_flow | 182935000000 USD | reported | Verified | NetCashProvidedByUsedInOperatingActivities = 182935000000 USD; 2025-07-01 to 2026-06-30 | 2026-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| shares_outstanding | 7425545491 shares | reported | Verified | dei:EntityCommonStockSharesOutstanding = 7425545491 shares; cover-page as-of 2026-07-23 | 2026-07-23 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| prior_year_revenue | 281724000000 USD | reported | Verified | RevenueFromContractWithCustomerExcludingAssessedTax = 281724000000 USD; 2024-07-01 to 2025-06-30 | 2025-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |
| prior_year_net_income | 101832000000 USD | reported | Verified | NetIncomeLoss = 101832000000 USD; 2024-07-01 to 2025-06-30 | 2025-06-30 | [0001193125-26-323660](https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/0001193125-26-323660-index.html); 10-K 2026; filed 2026-07-29; reporting 2026-06-30 |

### JPM — FY2025

Selected annual period: **2025-01-01 → 2025-12-31**; USD; filing **0001628280-26-008131**, filed **2026-02-13**.
Selected filing: https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html

| Line item | Mapped value / units | Input state | Confidence tier | Tags actually used, components, absences and mapping note | As of | Actual filing evidence |
| --- | ---: | --- | --- | --- | --- | --- |
| total_revenue | 182447000000 USD | reported | Verified | Revenues = 182447000000 USD; 2025-01-01 to 2025-12-31 | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| prohibited_income | 28032000000 USD | estimated | Estimated | InvestmentIncomeInterest = 28032000000 USD; 2025-01-01 to 2025-12-31; D-124 estimated interest-income proxy only: excludes untagged interest, prohibited-activity revenue and other analyst-identified prohibited income; not a complete gross prohibited-income total; analyst must review the same annual revenue period | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| total_assets | 4424900000000 USD | reported | Verified | Assets = 4424900000000 USD; instant 2025-12-31 | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| total_equity | 362438000000 USD | reported | Verified | StockholdersEquity = 362438000000 USD; instant 2025-12-31 | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| interest_bearing_debt | 64776000000 USD | estimated | Estimated | Used: ShortTermBorrowings = 64776000000 USD; Absent in selected filing: LongTermDebt, LongTermDebtNoncurrent, LongTermDebtCurrent, CommercialPaper; Alternative excluded: none; finance and operating lease liabilities excluded (D-44); No long-term debt tag found; total may be incomplete — analyst to confirm | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| finance_lease_liabilities | null USD | unknown | Estimated | Used: none; Absent in selected filing: FinanceLeaseLiability, FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent; Alternative excluded: none; No XBRL value among: FinanceLeaseLiability, FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| operating_lease_liabilities | 9337000000 USD | reported | Verified | Used: OperatingLeaseLiability = 9337000000 USD; Absent in selected filing: none; Alternative excluded: OperatingLeaseLiabilityCurrent, OperatingLeaseLiabilityNoncurrent | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| cash_and_equivalents | 343338000000 USD | estimated | Estimated | CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents = 343338000000 USD; instant 2025-12-31; broader balance includes restricted cash; estimated cash proxy | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| interest_bearing_investments | null USD | unknown | Estimated | No XBRL value among: ShortTermInvestments, MarketableSecuritiesCurrent, AvailableForSaleSecuritiesDebtSecuritiesCurrent | 2025-12-31 | none — no sourced observation |
| accounts_receivable | null USD | unknown | Estimated | No XBRL value among: AccountsReceivableNetCurrent | 2025-12-31 | none — no sourced observation |
| net_income | 57048000000 USD | reported | Verified | NetIncomeLoss = 57048000000 USD; 2025-01-01 to 2025-12-31 | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| operating_cash_flow | -147782000000 USD | reported | Verified | NetCashProvidedByUsedInOperatingActivities = -147782000000 USD; 2025-01-01 to 2025-12-31 | 2025-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| shares_outstanding | 2658186195 shares | reported | Verified | dei:EntityCommonStockSharesOutstanding = 2658186195 shares; cover-page as-of 2026-06-30 | 2026-06-30 | [0001628280-26-054343](https://www.sec.gov/Archives/edgar/data/19617/000162828026054343/0001628280-26-054343-index.html); 10-Q 2026; filed 2026-08-06; reporting 2026-06-30 |
| prior_year_revenue | 177556000000 USD | reported | Verified | Revenues = 177556000000 USD; 2024-01-01 to 2024-12-31 | 2024-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |
| prior_year_net_income | 58471000000 USD | reported | Verified | NetIncomeLoss = 58471000000 USD; 2024-01-01 to 2024-12-31 | 2024-12-31 | [0001628280-26-008131](https://www.sec.gov/Archives/edgar/data/19617/000162828026008131/0001628280-26-008131-index.html); 10-K 2025; filed 2026-02-13; reporting 2025-12-31 |

### MISSING — FY2025

Selected annual period: **2025-01-01 → 2025-12-31**; USD; filing **9999999999-26-000001**, filed **2026-02-01**.
Selected filing: https://www.sec.gov/Archives/edgar/data/9999999999/999999999926000001/9999999999-26-000001-index.html

| Line item | Mapped value / units | Input state | Confidence tier | Tags actually used, components, absences and mapping note | As of | Actual filing evidence |
| --- | ---: | --- | --- | --- | --- | --- |
| total_revenue | null USD | unknown | Estimated | No XBRL value among: Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, RevenueFromContractWithCustomerIncludingAssessedTax, SalesRevenueNet | 2025-12-31 | none — no sourced observation |
| prohibited_income | null USD | unknown | Estimated | No XBRL value among: InvestmentIncomeInterest | 2025-12-31 | none — no sourced observation |
| total_assets | null USD | unknown | Estimated | No XBRL value among: Assets | 2025-12-31 | none — no sourced observation |
| total_equity | null USD | unknown | Estimated | No XBRL value among: StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest, StockholdersEquity | 2025-12-31 | none — no sourced observation |
| interest_bearing_debt | null USD | unknown | Estimated | Used: none; Absent in selected filing: LongTermDebt, LongTermDebtNoncurrent, LongTermDebtCurrent, ShortTermBorrowings, CommercialPaper; Alternative excluded: none; finance and operating lease liabilities excluded (D-44); No XBRL value among: LongTermDebt, LongTermDebtNoncurrent, LongTermDebtCurrent, ShortTermBorrowings, CommercialPaper | 2025-12-31 | [9999999999-26-000001](https://www.sec.gov/Archives/edgar/data/9999999999/999999999926000001/9999999999-26-000001-index.html); 10-K 2025; filed 2026-02-01; reporting 2025-12-31 |
| finance_lease_liabilities | null USD | unknown | Estimated | Used: none; Absent in selected filing: FinanceLeaseLiability, FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent; Alternative excluded: none; No XBRL value among: FinanceLeaseLiability, FinanceLeaseLiabilityCurrent, FinanceLeaseLiabilityNoncurrent | 2025-12-31 | [9999999999-26-000001](https://www.sec.gov/Archives/edgar/data/9999999999/999999999926000001/9999999999-26-000001-index.html); 10-K 2025; filed 2026-02-01; reporting 2025-12-31 |
| operating_lease_liabilities | null USD | unknown | Estimated | Used: none; Absent in selected filing: OperatingLeaseLiability, OperatingLeaseLiabilityCurrent, OperatingLeaseLiabilityNoncurrent; Alternative excluded: none; No XBRL value among: OperatingLeaseLiability, OperatingLeaseLiabilityCurrent, OperatingLeaseLiabilityNoncurrent | 2025-12-31 | [9999999999-26-000001](https://www.sec.gov/Archives/edgar/data/9999999999/999999999926000001/9999999999-26-000001-index.html); 10-K 2025; filed 2026-02-01; reporting 2025-12-31 |
| cash_and_equivalents | null USD | unknown | Estimated | No XBRL value among: CashAndCashEquivalentsAtCarryingValue, CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents | 2025-12-31 | none — no sourced observation |
| interest_bearing_investments | null USD | unknown | Estimated | No XBRL value among: ShortTermInvestments, MarketableSecuritiesCurrent, AvailableForSaleSecuritiesDebtSecuritiesCurrent | 2025-12-31 | none — no sourced observation |
| accounts_receivable | null USD | unknown | Estimated | No XBRL value among: AccountsReceivableNetCurrent | 2025-12-31 | none — no sourced observation |
| net_income | null USD | unknown | Estimated | No XBRL value among: NetIncomeLoss | 2025-12-31 | none — no sourced observation |
| operating_cash_flow | null USD | unknown | Estimated | No XBRL value among: NetCashProvidedByUsedInOperatingActivities | 2025-12-31 | none — no sourced observation |
| shares_outstanding | null shares | unknown | Estimated | No XBRL value among: dei:EntityCommonStockSharesOutstanding | 2025-12-31 | none — no sourced observation |
| prior_year_revenue | null USD | unknown | Estimated | No XBRL value among: Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, RevenueFromContractWithCustomerIncludingAssessedTax, SalesRevenueNet | 2024-12-31 | none — no sourced observation |
| prior_year_net_income | null USD | unknown | Estimated | No XBRL value among: NetIncomeLoss | 2024-12-31 | none — no sourced observation |

## Founder checkpoint

Review the totals, raw components/absences, period selection, unknowns, unverified candidate cells and process-local request-budget boundary above. Work stops here. The full downstream requirements, including company+period+line_item analyst protection, stored non-current incoming SEC facts, `SEC value changed since correction`, and audited `Accept SEC value`, are retained only for use after explicit founder go-ahead. Completion or merge is not that go-ahead. No continuation task is created or started.
