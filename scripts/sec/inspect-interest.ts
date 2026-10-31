/** Read-only SEC retrieval. No database imports or writes. */
import { SecClient } from "../../src/ingest/sec/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const client = new SecClient();
const directory = "/tmp/suhail-interest-evidence";
mkdirSync(directory, { recursive: true });
async function main() {
for (const [name, cik] of [["aapl", "320193"], ["msft", "789019"], ["jpm", "19617"]]) {
  const { data, retrieval } = await client.companyfacts(cik);
  const serialized = JSON.stringify(data);
  writeFileSync(`${directory}/${name}.json`, serialized);
  writeFileSync(`${directory}/${name}-metadata.json`, JSON.stringify(retrieval));
  console.log(name, retrieval, "sha256", createHash("sha256").update(serialized).digest("hex"));
  for (const [tag, concept] of Object.entries(data.facts["us-gaap"] ?? {})) {
    if (!/^(InvestmentIncomeInterest|InterestIncome|InterestAndDividendIncomeOperating|InvestmentIncomeInterestAndDividend)$/.test(tag)) continue;
    console.log(tag, concept.description);
    console.log(JSON.stringify(Object.entries(concept.units).flatMap(([unit, rows]) =>
      rows.filter(r => r.start && r.end >= "2025-01-01" && r.form === "10-K" && r.fp === "FY").slice(-5).map(r => ({ unit, ...r })))));
  }
}
}
main().catch(() => { console.error("SEC interest evidence retrieval failed"); process.exitCode = 1; });
