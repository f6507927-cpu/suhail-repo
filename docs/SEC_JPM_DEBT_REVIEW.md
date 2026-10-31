# JPM debt candidates — inspected before D-116/D-117 changes

Source: https://data.sec.gov/api/xbrl/companyfacts/CIK0000019617.json
Full companyfacts retrieved 2026-10-16T00:51:15.524Z (temporary download, not a raw-response archive).
Latest 10-K: period end 2025-12-31, filed 2026-02-13, accession `0001628280-26-008131`.
These are selected-filing, period-end observations, not debt-security asset holdings.

| us-gaap tag | USD | Treatment |
| --- | ---: | --- |
| ShortTermBorrowings | 64776000000 | Existing debt component |
| LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities | 435206000000 | Excluded: includes leases, D-44 |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInNextRollingTwelveMonths | 42589000000 | Analyst reconciliation candidate only |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearTwo | 55800000000 | Analyst reconciliation candidate only |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearThree | 105400000000 | Analyst reconciliation candidate only |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearFour | 31400000000 | Analyst reconciliation candidate only |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingYearFive | 39800000000 | Analyst reconciliation candidate only |
| LongTermDebtMaturitiesRepaymentsOfPrincipalInRollingAfterYearFive | 160299000000 | Analyst reconciliation candidate only |

Neither `LongTermDebt` nor `LongTermDebtNoncurrent` exists in this filing.
Maturity payments are not automatically interchangeable with a carrying-value
total. No maturity tag or combined debt/lease tag is added to the mapping.

Other borrowing observations are `FederalFundsPurchasedAndSecuritiesSoldUnderAgreementsToRepurchase`
(442396000000 USD) and `SecuritiesSoldUnderAgreementsToRepurchase`
(433161000000 USD). They overlap and are not added to the specified component
list without a separate mapping decision. Securities-borrowed positions,
collateral/netting disclosures and debt-security assets are not total-debt proxies.

`OperatingLeaseLiability` is 9337000000 USD. D-117 picks up that separate total;
it is never added to debt. D-116 retains JPM debt at 64776000000 USD but marks it
estimated/Estimated with:

> No long-term debt tag found; total may be incomplete — analyst to confirm
