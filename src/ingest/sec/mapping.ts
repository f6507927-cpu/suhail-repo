/**
 * D-05/D-06: ordered, versioned mapping. Evidence and per-tag availability:
 * docs/SEC_ANNUAL_MAPPING.md (generated from the committed fixtures).
 * No persistence, sector classification, EBITDA, or screening formulas here.
 */
export const SEC_CALCULATION_VERSION = "calc-2026.10.6";
export function prohibitedIncomeWarning(tag: string) {
  return "; D-124 estimated interest-income proxy only: excludes untagged interest, prohibited-activity revenue and other analyst-identified prohibited income; not a complete gross prohibited-income total; analyst must review the same annual revenue period" +
    (tag === "InvestmentIncomeInterestAndDividend" ? "; source combines interest and dividends on nonoperating securities; conservative precaution includes the full combined amount, not pure interest" : "") +
    (tag === "InterestIncomeOther" ? "; source interest earned on interest-bearing assets classified as other, not all interest income" : "") +
    (tag === "InterestAndOtherIncome" ? "; broader source includes ancillary other income and may be net; positive combined amount is a precautionary proxy, not pure interest or gross prohibited income" : "");
}
export const candidates = {
  // AAPL/MSFT use ExcludingAssessedTax; JPM uses Revenues. The other two
  // supplied alternatives remain supported but unverified in these samples.
  total_revenue: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
  // Explicit precedence; scope and limitations must travel with every proxy.
  // Evidence: docs/SEC_LAUNCH_MAPPING.md. Historical presence is not eligibility.
  prohibited_income: ["InvestmentIncomeInterest", "InvestmentIncomeInterestAndDividend",
    "InterestIncomeOther", "InterestAndOtherIncome"],
  total_assets: ["Assets"], // All three.
  // All three exercise StockholdersEquity; the first choice is sample-unverified.
  total_equity: ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"],
  // D-44/D-113: aggregate replaces BOTH long-term components; leases excluded.
  interest_bearing_debt: ["LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtCurrent",
    "LongTermNotesPayable", "NotesPayableCurrent", "ShortTermBorrowings", "CommercialPaper"],
  // D-117: prefer the total; otherwise sum present components, never both.
  finance_lease_liabilities: ["FinanceLeaseLiability", "FinanceLeaseLiabilityCurrent", "FinanceLeaseLiabilityNoncurrent"],
  operating_lease_liabilities: ["OperatingLeaseLiability", "OperatingLeaseLiabilityCurrent", "OperatingLeaseLiabilityNoncurrent"],
  // Explicit expansion of the attachment's unnamed "broader restricted-cash tag".
  cash_and_equivalents: ["CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  // D-06: these labels do not prove interest-bearing status. Always estimated.
  interest_bearing_investments: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"],
  accounts_receivable: ["AccountsReceivableNetCurrent"],
  // ProfitLoss is consolidated including noncontrolling interests, not parent-only.
  net_income: ["NetIncomeLoss", "ProfitLoss"],
  operating_cash_flow: ["NetCashProvidedByUsedInOperatingActivities"],
  // DEI is a cover-page instant, deliberately NOT the annual balance-sheet end.
  shares_outstanding: ["dei:EntityCommonStockSharesOutstanding"],
} as const;

export const durationItems = new Set(["total_revenue", "prohibited_income", "net_income", "operating_cash_flow"]);
export const sumItems = new Set(["interest_bearing_debt", "finance_lease_liabilities", "operating_lease_liabilities"]);
