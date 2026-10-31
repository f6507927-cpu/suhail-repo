/** Offline reduction of full public captures. Run BEFORE changing the mapping.
 * No network, database, credentials, or synthetic financial observations.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { mapAnnual } from "../../src/ingest/sec/annual";
import { candidates, SEC_CALCULATION_VERSION } from "../../src/ingest/sec/mapping";
import { annual } from "../../src/ingest/sec/selection";
import type { CompanyFacts, Fixture } from "../../src/ingest/sec/types";
const directory = "generated-artifacts/sec-launch";
const output = "tests/fixtures/sec/launch";
if (String(SEC_CALCULATION_VERSION) !== "calc-2026.10.4")
  throw new Error("Baseline reduction must run on original .4 code; refusing to overwrite historical fixtures with newer mapping");
mkdirSync(output, { recursive: true });
const tickers = ["AAPL", "MSFT", "AVGO", "CSCO", "QCOM", "NFLX", "COST", "HD", "AMD", "TXN", "PEP", "LLY", "ORCL", "JNJ", "XOM"];
for (const ticker of tickers) {
  const data: CompanyFacts = JSON.parse(readFileSync(`${directory}/${ticker}.json`, "utf8"));
  const metadata = JSON.parse(readFileSync(`${directory}/${ticker}-metadata.json`, "utf8"));
  const before = JSON.parse(readFileSync(`${directory}/${ticker}-before.json`, "utf8"));
  const facts: CompanyFacts["facts"] = {};
  for (const [ns, concepts] of Object.entries(data.facts)) for (const [tag, concept] of Object.entries(concepts)) {
    const relevant = Object.values(candidates).flat().some(t => t === tag || t === `${ns}:${tag}`) ||
      /interest|debt|borrow|notespayable|profitloss|netincomeloss/i.test(tag);
    const units = Object.fromEntries(Object.entries(concept.units).map(([unit, rows]) => {
      const latest = [...rows].sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0];
      const latestAnnual = [...rows].filter(r => annual(r)).sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0];
      const latestFY = [...rows].filter(r => ["10-K", "10-K/A"].includes(r.form) && r.fp === "FY")
        .sort((a, b) => b.end.localeCompare(a.end) || b.filed.localeCompare(a.filed))[0];
      return [unit, rows.filter(r =>
        (relevant && (r.end >= "2023-01-01" || r === latest || r === latestAnnual || r === latestFY)) ||
        (unit === "USD" && annual(r) && r.accn === before.period.filing_reference))];
    }).filter(([, rows]) => (rows as unknown[]).length));
    if (relevant || Object.keys(units).length) (facts[ns] ??= {})[tag] = { ...concept, units };
  }
  const fixture: Fixture = { metadata: { ...metadata,
    trimming: "Unchanged observations: mapping/interest/debt/net-income concepts since 2023 plus latest historical row per unit; all USD annual anchors in selected accession. Empty concepts retain evidence of historical presence. Full raw SHA256 in metadata.",
  }, companyfacts: { cik: data.cik, entityName: data.entityName, facts } };
  const reduced = mapAnnual(fixture.companyfacts, fixture.metadata);
  if (JSON.stringify(reduced) !== JSON.stringify(before)) {
    console.log(ticker, reduced.facts.filter((f, i) => JSON.stringify(f) !== JSON.stringify(before.facts[i])).map(f => [f.line_item, f.mapping_note, f.source?.reporting_period]));
    throw new Error(`${ticker}: trim changed baseline mapping`);
  }
  writeFileSync(`${output}/${ticker}.json`, JSON.stringify(fixture) + "\n");
  writeFileSync(`${output}/${ticker}-before.json`, JSON.stringify(before) + "\n");
}
