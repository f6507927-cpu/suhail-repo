import "server-only";
import { sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { addSecurity } from "../financial/service";
import { lookupSecurity, ingestSecurity, safeIngestError, type Mutation } from "../../ingest/sec/ingest";
import { launchPreflight, prepareLaunchDraft, requireLaunchActor } from "./draft";
import { applyLaunchEvidence, launchTickerReport } from "./evidence";
import { CLOSE_FIELDS, MONTH_ENDS, type LaunchDefinition, type LaunchRow } from "./contracts";
import type { SecurityLookup } from "../financial/contracts";

type LaunchSec = {
  lookup: (ticker: string) => Promise<SecurityLookup>;
  ingest: (id: string, mutate: Mutation) => Promise<unknown>;
};
function unavailableReport(row: LaunchRow) {
  return {
    ticker: row.ticker, closes: MONTH_ENDS.map(month => ({ month, close: null })),
    selectedQuarter: null, stale: null, freshnessNote: null, market_value_basis: null,
    activity_category: null, requested_activity_category: row.activity_category,
    prohibited_income: { supplied: row.prohibited_income !== "", value: null, state: "missing", note: null },
    shareClassConcern: ["Cover-page evidence unavailable; no class allocation assumed"],
    missing: ["current annual period", "shares_outstanding", "total_equity", "total_revenue",
      "interest_bearing_debt", "prohibited_income", "business_segments",
      ...MONTH_ENDS.map(month => `Sourced attested close for ${month}`)],
  };
}

export async function runLaunch(options: { email: string; dryRun: boolean; definition: LaunchDefinition; rows: LaunchRow[]; asOf: string },
  output: (value: unknown) => void = console.log,
  sec: LaunchSec = { lookup: lookupSecurity, ingest: ingestSecurity }) {
  const preflight = await dbApp.transaction(async tx => {
    await tx.execute(sql`set transaction read only`);
    return launchPreflight(tx, options.email, options.definition);
  });
  output({ dryRun: options.dryRun, plan: preflight.plan, tickers: options.rows.map(r => ({
    ticker: r.ticker,
    manualCloses: MONTH_ENDS.map((month, i) => ({ date: month, month_end_for: month, close: r[CLOSE_FIELDS[i]] })),
    source: { type: "market_data", provider: "Manual entry", label: r.price_source_label, url: r.price_source_url },
    activity: { category: r.activity_category, basis: r.category_basis, revenueShare: 1, amount: "sourced current annual total_revenue (contingent)" },
    prohibitedIncome: r.prohibited_income === "" ? "preserve SEC estimate" : {
      value: r.prohibited_income, source: r.prohibited_income_source, note: r.prohibited_income_note,
    },
    contingent: ["SEC Nasdaq/NYSE lookup; add only if missing or outside universe", "serial SEC annual ingestion; retain protected corrections",
      "three sourced manual month-end closes (unchanged effective evidence is a no-op)",
      "one whole-company annual revenue segment if sourced revenue exists; reject conflicting segments",
      r.prohibited_income === "" ? "preserve SEC prohibited-income estimate" : "sourced annual prohibited-income correction",
      "refresh market value with share-class guard; report all missing inputs"],
  })) });
  if (options.dryRun) return;
  const actor = await dbApp.transaction(tx => prepareLaunchDraft(tx, options.email, options.definition));
  const mutate: Mutation = work => dbApp.transaction(async tx => work(tx, await requireLaunchActor(tx, actor)));
  for (const row of options.rows) {
    let securityId: string | undefined;
    let outcome = "failed";
    let failure: string | null = null;
    try {
      const lookup = await sec.lookup(row.ticker);
      securityId = await mutate((tx, current) => addSecurity(tx, current, lookup));
      await sec.ingest(securityId, mutate);
      outcome = "ingested";
      await mutate((tx, current) => applyLaunchEvidence(tx, current!, securityId!, row));
    } catch (error) { failure = safeIngestError(error); }
    const report = securityId ? await mutate((tx) => launchTickerReport(tx, securityId!, row, options.asOf))
      .catch(() => unavailableReport(row)) : unavailableReport(row);
    output({ ...report, ingestOutcome: outcome, error: failure });
  }
}
