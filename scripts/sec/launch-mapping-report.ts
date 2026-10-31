/** Offline report from full captures + unchanged genuine reduced fixtures.
 * Run: node --import tsx scripts/sec/launch-mapping-report.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mapAnnual } from "../../src/ingest/sec/annual";
import { annual, entries, latest, selectAnnual } from "../../src/ingest/sec/selection";
import type { CompanyFacts, Fixture } from "../../src/ingest/sec/types";
import { legacyLaunchFact } from "./legacy-launch-mapping";
const directory = "generated-artifacts/sec-launch";
const tickers = ["AAPL", "MSFT", "AVGO", "CSCO", "QCOM", "NFLX", "COST", "HD", "AMD", "TXN", "PEP", "LLY", "ORCL", "JNJ", "XOM"];
const esc = (v: unknown) => String(v ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (cells: unknown[]) => `| ${cells.map(esc).join(" | ")} |`;
const lines = ["# SEC launch mapping — same-evidence local comparison", "",
  "The founder reported 24/25 ingested in a separate live setup:launch run. That is not this comparison. These results use full public companyfacts captured locally and identical reduced evidence under old (.4) and new (.6) rules. No Supabase access (including reads), setup:launch, live ingest, migrations, seeds, deployment or hosted changes were performed. Disposable local PostgreSQL checks are separately documented in the validation section. This is not a claim of 25/25 live success.", "",
  "## Rules and scope", "",
  "- SEC mapping/current screening provenance advances to calc-2026.10.6; .1–.5 remain supported, engine-1.0.2 and market-value calc-2026.10.5 stay unchanged. Historical engine goldens are not replaced.",
  "- Ordered income candidates: InvestmentIncomeInterest → InvestmentIncomeInterestAndDividend → InterestIncomeOther → InterestAndOtherIncome. Every result is estimated/Estimated and incomplete. Combined dividends are included as a conservative precaution, not claimed to be pure interest. Broader ancillary/net other income is not gross prohibited income. A negative selected candidate remains unknown, not gross income; no stale, quarterly, YTD or wrong-unit substitution.",
  "- NetIncomeLoss remains first; ProfitLoss is consolidated after-tax profit including noncontrolling interests, not parent-attributable net income. AVGO's NetIncomeLossAttributableToParent is absent, so it was NOT invented or mapped.",
  "- Notes are carrying-value alternatives to matching long-term debt components, not additive duplicates. ShortTermBorrowings replaces CommercialPaper. Additional ORCL/JNJ overlaps below are scoped to the verified CIK + accession, not guessed for future filings. Superseded alternatives need not match the selected period; every selected present component must match, or the entire sum remains unknown.",
  "- ORCL note 6: LongTermNotesPayable + NotesPayableCurrent include commercial paper and other borrowings; those subordinate balances are excluded. D-116 remains literal: neither alias establishes completeness. Without usable LongTermDebt or LongTermDebtNoncurrent, the numeric total is estimated/Estimated with `No long-term debt tag found; total may be incomplete — analyst to confirm`.",
  "- JNJ note 7: ShortTermBorrowings is the filing's current loans/notes balance INCLUDING current long-term maturities. Use LongTermDebtNoncurrent + that balance; exclude LongTermDebt and LongTermDebtCurrent to prevent double counting. CommercialPaper is subordinate and its 2024 transaction is not a 2025 balance.",
  "- No lease-containing DebtCurrent, LongTermDebtAndCapitalLeaseObligations, maturity schedules, face amounts or cash-flow proceeds/repayments are added. Zero remains present. No selected components remains unknown.",
  "- The original annual algorithm already accepts 350–380 inclusive days. No annual-selection defect was found; start/end, USD, FY, 10-K/10-K/A and tie-break constraints are unchanged.", "",
  "## Reproducible comparison", "",
  "Before editing, capture-launch.ts ran the original mapAnnual on full facts; prepare-launch-fixtures.ts confirmed identical full .4 outputs after trimming. Committed *-before.json files preserve those actual outputs. legacyLaunchFact independently re-executes the original compared rules and asserts equality. The new mapper is run on the same fixtures. The full-capture inventory is generated below; retained JSON evidence and tests can be used offline without raw captures.", "",
  "| Ticker / item | Period / accession (filed) | Old value / state / reason | New value / state / confidence | Selected tags/components, notes / unresolved gaps |",
  "| --- | --- | --- | --- | --- |"];
const results: Record<string, unknown> = {};
const inventory: unknown[] = [];
for (const ticker of tickers) {
  const fixture: Fixture = JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}.json`, "utf8"));
  const before: ReturnType<typeof mapAnnual> = JSON.parse(readFileSync(`tests/fixtures/sec/launch/${ticker}-before.json`, "utf8"));
  const after = mapAnnual(fixture.companyfacts, fixture.metadata);
  const fullData: CompanyFacts = JSON.parse(readFileSync(`${directory}/${ticker}.json`, "utf8"));
  if (JSON.stringify(after) !== JSON.stringify(mapAnnual(fullData, fixture.metadata)))
    throw new Error(`${ticker}: reduced evidence changed new mapping`);
  const data = fixture.companyfacts;
  const items = ticker === "ORCL" || ticker === "JNJ" ? ["interest_bearing_debt"] :
    ticker === "AVGO" ? ["prohibited_income", "net_income"] : ticker === "XOM" ? ["total_revenue", "net_income", "interest_bearing_debt", "prohibited_income"] : ["prohibited_income"];
  results[ticker] = { period: after.period, facts: after.facts };
  for (const item of items) {
    const old = before.facts.find(f => f.line_item === item)!;
    const next = after.facts.find(f => f.line_item === item)!;
    if (["prohibited_income", "net_income", "interest_bearing_debt"].includes(item)) {
      const projection = ({ value, input_state, unknown_note }: typeof old) => ({ value, input_state, unknown_note });
      if (JSON.stringify(legacyLaunchFact(data, item)) !== JSON.stringify(projection(old)))
        throw new Error(`${ticker} old reference mismatch`);
    }
    lines.push(table([`${ticker} / ${item}`, `${after.period.period_start} to ${after.period.period_end}; ${after.period.filing_reference}; ${after.period.reported_date}`,
      `${old.value ?? "null"} / ${old.input_state} / ${old.unknown_note ?? old.mapping_note}`,
      `${next.value ?? "null"} / ${next.input_state} / ${next.confidence_tier}`, next.mapping_note]));
  }
}
lines.push("", "## Full-companyfacts interest-concept inventory", "",
  "The following inventory was computed from FULL facts, not the old trimmed AAPL/MSFT/JPM samples. For each present interest-income concept, it shows the latest observation, latest annual USD observation and compatible selected-period evidence separately. No rows means absence, never zero. Tax interest expense, debt rates, pre-tax profit and minority interests are not interest-income concepts. Broader InvestmentIncomeNet / InvestmentIncomeNonoperating are inspected but not adopted: they include investment gains/other returns. All namespaces returned by companyfacts were inspected.", "");
for (const ticker of tickers.slice(0, 12)) {
  const raw = readFileSync(`${directory}/${ticker}.json`);
  const data: CompanyFacts = JSON.parse(raw.toString());
  const metadata = JSON.parse(readFileSync(`${directory}/${ticker}-metadata.json`, "utf8"));
  if (createHash("sha256").update(raw).digest("hex") !== metadata.original_sha256) throw new Error("Capture hash mismatch");
  const selected = selectAnnual(data);
  lines.push(`### ${ticker}`, "",
    `Selected: ${selected.start} to ${selected.end}; ${selected.accn}; ${selected.form}; filed ${selected.filed}. Retrieved ${metadata.retrieved_at}; [full facts](${metadata.url}); SHA256 ${metadata.original_sha256}.`, "",
    "| Namespace:concept / SEC description | Evidence role | USD value (or actual unit) | Start / end | Accession / form / fp / filed | Compatible? |",
    "| --- | --- | --- | --- | --- | --- |");
  for (const [ns, concepts] of Object.entries(data.facts)) for (const [tag, concept] of Object.entries(concepts)) {
    if (!/(?:^InvestmentIncome|InterestIncome|^InterestAnd.*Income)/i.test(tag)) continue;
    const rows = entries(data, `${ns}:${tag}`);
    const mostRecent = [...rows].sort((a, b) => b.end.localeCompare(a.end) || latest(a, b))[0];
    const mostRecentAnnual = rows.filter(e => annual(e) && e.unit === "USD").sort((a, b) => b.end.localeCompare(a.end) || latest(a, b))[0];
    const compatible = rows.filter(e => annual(e) && e.unit === "USD" && e.start === selected.start && e.end === selected.end).sort(latest)[0];
    const record = { ticker, namespace: ns, concept: tag, description: concept.description, retrieval: metadata,
      selected: { start: selected.start, end: selected.end, accession: selected.accn },
      latest: mostRecent ?? null, latestAnnual: mostRecentAnnual ?? null, compatible: compatible ?? null };
    inventory.push(record);
    for (const [role, e] of [["latest observation", mostRecent], ["latest annual USD", mostRecentAnnual], ["selected-period compatible", compatible]] as const) {
      lines.push(table([`${ns}:${tag}: ${concept.description}`, role, e ? `${e.val} ${e.unit}` : "none",
        e ? `${e.start ?? "instant"} / ${e.end}` : "—", e ? `${e.accn} / ${e.form} / ${e.fp} / ${e.filed}` : "—",
        e ? annual(e) && e.unit === "USD" && e.start === selected.start && e.end === selected.end : false]));
    }
  }
  if (!inventory.some(r => (r as { ticker: string }).ticker === ticker)) lines.push("No interest-income concepts present.");
  lines.push("");
}
lines.push("## Latest ORCL/JNJ annual debt-concept inventory", "",
  "All debt/borrowing/note concepts with observations in the selected accession are listed; flows, maturity schedules, lease-containing concepts and historical instants are evidence to reject, not automatic replacements. Balance amounts below are USD unless shown otherwise. Filing HTML and its independent retrieval hash are in filing-evidence.json.", "");
for (const ticker of ["ORCL", "JNJ"]) {
  const data: CompanyFacts = JSON.parse(readFileSync(`${directory}/${ticker}.json`, "utf8"));
  const metadata = JSON.parse(readFileSync(`${directory}/${ticker}-metadata.json`, "utf8"));
  const selected = selectAnnual(data);
  lines.push(`### ${ticker} debt`, "",
    `Selected ${selected.accn}, filed ${selected.filed}, period end ${selected.end}; retrieved ${metadata.retrieved_at}; full-facts SHA256 ${metadata.original_sha256}.`, "",
    "| Namespace:concept / description | Value / unit | Start / end | Form / filed | Treatment |",
    "| --- | --- | --- | --- | --- |");
  for (const [ns, concepts] of Object.entries(data.facts)) for (const [tag, c] of Object.entries(concepts)) {
    if (!/debt|borrow|notespayable|commercialpaper/i.test(tag)) continue;
    for (const e of entries(data, `${ns}:${tag}`).filter(e => e.accn === selected.accn)) {
      if (e.end !== selected.end && tag !== "CommercialPaper") continue;
      lines.push(table([`${ns}:${tag}: ${c.description}`, `${e.val} ${e.unit}`, `${e.start ?? "instant"} / ${e.end}`,
        `${e.form} / ${e.filed}`, /^(LongTermDebt|LongTermDebtCurrent|LongTermDebtNoncurrent|LongTermNotesPayable|NotesPayableCurrent|ShortTermBorrowings|CommercialPaper)$/.test(tag) ?
          "Carrying-value candidate; see comparison's used/excluded components" : "Not selected: scope, maturity, rate, face amount or flow is not an approved non-lease carrying balance"]));
    }
  }
  lines.push("");
}
lines.push("## Interpretation, limitations and validation", "",
  "See [SEC_LAUNCH_FINDINGS.md](SEC_LAUNCH_FINDINGS.md) for the concise issuer-specific annual failures, original-run XOM limitation, validation commands and stop boundary. Reproducible filing excerpts with URL, retrieval time and full-HTML SHA256 are committed in tests/fixtures/sec/launch/filing-evidence.json.", "");
writeFileSync("tests/fixtures/sec/launch/results.json", JSON.stringify(results) + "\n");
writeFileSync("tests/fixtures/sec/launch/interest-inventory.json", JSON.stringify(inventory) + "\n");
writeFileSync("docs/SEC_LAUNCH_MAPPING.md", lines.join("\n") + "\n");
