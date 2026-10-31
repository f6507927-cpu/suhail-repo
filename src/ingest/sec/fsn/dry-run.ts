import type { SecClient } from "../client";
import { mapAnnual } from "../annual";
import { REVIEW_TICKERS, type FsnTarget } from "./contracts";
import { resolveFsn } from "./resolve";

/** No DB imports, disk writes, audit calls, workflow actions or screening guesses. */
export async function runFsnDryRun(client: SecClient, covered: string[], output: (row: unknown) => void, override?: string) {
  const listings = (await client.tickers()).data;
  const targets: FsnTarget[] = [];
  for (const ticker of REVIEW_TICKERS) {
    if (!covered.includes(ticker)) {
      output({ ticker, reason: "Not in covered universe", screeningImpact: "Skipped: database required" }); continue;
    }
    const listing = listings.data.map(row => Object.fromEntries(listings.fields.map((key, i) => [key, row[i]])))
      .find(row => row.ticker === ticker);
    if (!listing || !/^\d{1,10}$/.test(String(listing.cik))) {
      output({ ticker, reason: "No SEC CIK identity", screeningImpact: "Skipped: database required" }); continue;
    }
    try {
      const cik = String(listing.cik).padStart(10, "0");
      const downloaded = await client.companyfacts(cik);
      if (Number(downloaded.data.cik) !== Number(cik)) throw new Error("CIK mismatch");
      targets.push({ ticker, cik, mapped: mapAnnual(downloaded.data, downloaded.retrieval) });
    } catch {
      output({ ticker, reason: "Companyfacts annual selection failed", screeningImpact: "Skipped: database required" });
    }
  }
  const results = await resolveFsn(targets, client, override);
  for (const target of targets) {
    const result = results.get(target.ticker)!;
    const revenue = target.mapped.facts.find(f => f.line_item === "total_revenue");
    const existing = target.mapped.facts.find(f => f.line_item === "prohibited_income");
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
      reason: result.reason, customTagSuggestions: result.suggestions,
      screeningImpact: "Skipped: database required to read the active production methodology, current screening result and protected analyst evidence; no status inferred",
    });
  }
}
