import type { SecClient } from "../client";
import { mapAnnual } from "../annual";
import { REVIEW_TICKERS, type FsnTarget } from "./contracts";
import { resolveFsn } from "./resolve";
import { balanceSheetFacts, unavailableBalanceSheet } from "./balance-sheet";
import { calculateUpperBound, upperBoundPolicySchema } from "../../../engine/upper-bound";
import { proposedV11IncomeCriterion } from "../../../lib/methodology/proposed-v1.1";

/** No DB imports, disk writes, audit calls, workflow actions or screening guesses. */
export async function runFsnDryRun(client: SecClient, covered: string[], output: (row: unknown) => void,
  override?: string, upperBound = false) {
  const listings = (await client.tickers()).data;
  const targets: FsnTarget[] = [];
  const skip = (ticker: string, reason: string) => output({ ticker, dryRun: true, fieldsFound: [], reason,
    ...(upperBound ? { upperBound: { bound: null, ratio: null, criterionPreview: "unknown", reason },
      balanceSheet: { components: Object.fromEntries(["cash", "short_term", "long_term"].map(name =>
        [name, { value: null, state: "unknown", label: "unknown", reason }])) } } : {}),
    screeningImpact: "Skipped: database required" });
  for (const ticker of upperBound ? [...new Set(covered)] : REVIEW_TICKERS) {
    if (!covered.includes(ticker)) {
      skip(ticker, "Not in covered universe"); continue;
    }
    const listing = listings.data.map(row => Object.fromEntries(listings.fields.map((key, i) => [key, row[i]])))
      .find(row => row.ticker === ticker);
    if (!listing || !/^\d{1,10}$/.test(String(listing.cik))) {
      skip(ticker, "No SEC CIK identity"); continue;
    }
    try {
      const cik = String(listing.cik).padStart(10, "0");
      const downloaded = await client.companyfacts(cik);
      if (Number(downloaded.data.cik) !== Number(cik)) throw new Error("CIK mismatch");
      targets.push({ ticker, cik, mapped: mapAnnual(downloaded.data, downloaded.retrieval) });
    } catch {
      skip(ticker, "Companyfacts annual selection failed");
    }
  }
  const results = await resolveFsn(targets, client, override, upperBound);
  for (const target of targets) {
    const result = results.get(target.ticker)!;
    const revenue = target.mapped.facts.find(f => f.line_item === "total_revenue");
    const existing = target.mapped.facts.find(f => f.line_item === "prohibited_income");
    const sheet = result.balanceSheet ?? unavailableBalanceSheet(target, result.reason ?? "Balance sheet unavailable");
    const criterion = proposedV11IncomeCriterion();
    const policy = upperBoundPolicySchema.parse(criterion.treatmentRuleData.suhail_upper_bound);
    const comparison = calculateUpperBound(policy,
      [sheet.components.cash.value, sheet.components.short_term.value, sheet.components.long_term.value],
      revenue?.value ?? null, criterion.threshold!);
    const chosenIncome = existing?.value ?? result.fact?.value ?? null;
    output({
      ticker: target.ticker, adapter: "sec_fsn", dryRun: true,
      selectedFiling: { accession: target.mapped.period.filing_reference, filed: target.mapped.period.reported_date,
        period: { start: target.mapped.period.period_start, end: target.mapped.period.period_end },
        filingLink: target.mapped.period.source.source_url, totalRevenue: revenue?.value ?? null },
      companyfactsIncome: { value: existing?.value ?? null, mappingNote: existing?.mapping_note ?? null,
        filingLink: existing?.source?.source_url ?? null },
      fieldsFound: result.fact ? [{ field: result.fact.line_item, tag: result.tag, value: result.fact.value,
        period: { start: target.mapped.period.period_start, end: target.mapped.period.period_end },
        accession: result.fact.source?.document_reference, filingLink: result.fact.source?.source_url,
        sourceTier: result.fact.source?.confidence_tier, factTier: result.fact.confidence_tier,
        warning: result.fact.mapping_note }] : [],
      reason: result.reason, customTagSuggestions: result.suggestions, revenueAnchor: result.revenueAnchor ?? null,
      ...(upperBound ? {
        methodologyPreview: { version: "1.1", workflow: "draft", productionEnabled: false,
          annual_yield_assumption: policy.annual_yield_assumption, explanation: policy.explanation },
        balanceSheet: sheet,
        upperBound: { ...comparison, thresholdPercent: criterion.threshold,
          used: chosenIncome === null && comparison.bound !== null,
          criterionPreview: chosenIncome !== null ? "Existing income wins; upper-bound rule not used"
            : comparison.passes ? "pass (Estimated; upper bound)" : "unknown",
          selectedIncome: chosenIncome, filingLink: sheet.filingLink,
          analystOverrides: "Not checked: database unavailable; comparison is hypothetical, not an actual screening result",
          preparedInputs: balanceSheetFacts(sheet, false) },
      } : {}),
      screeningImpact: "Skipped: database required to read the active production methodology, current screening result and protected analyst evidence; no status inferred",
    });
  }
}
