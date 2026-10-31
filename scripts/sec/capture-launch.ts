/** Public SEC only; serial requests through the existing process-local budget.
 * Raw captures are temporary/ignored, never database inputs or launch seeds.
 * Run: pnpm exec tsx --conditions=react-server scripts/sec/capture-launch.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SecClient, SecRequestError } from "../../src/ingest/sec/client";
import { mapAnnual } from "../../src/ingest/sec/annual";

const issuers = { AAPL: 320193, MSFT: 789019, AVGO: 1730168, CSCO: 858877,
  QCOM: 804328, NFLX: 1065280, COST: 909832, HD: 354950, AMD: 2488,
  TXN: 97476, PEP: 77476, LLY: 59478, ORCL: 1341439, JNJ: 200406, XOM: 34088 };
const directory = "generated-artifacts/sec-launch";
mkdirSync(directory, { recursive: true });
let raw = "";
const client = new SecClient({ fetcher: async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) raw = await response.clone().text();
  return response;
} });
async function main() {
  for (const [ticker, cik] of Object.entries(issuers)) {
    const { data, retrieval } = await client.companyfacts(cik);
    const metadata = { ...retrieval, original_sha256: createHash("sha256").update(raw).digest("hex") };
    writeFileSync(`${directory}/${ticker}.json`, raw);
    writeFileSync(`${directory}/${ticker}-metadata.json`, JSON.stringify(metadata, null, 2));
    const mapped = mapAnnual(data, retrieval);
    // Never overwrite the original .4 comparison with a later mapping result.
    const suffix = mapped.calculation_version === "calc-2026.10.4" ? "before" : mapped.calculation_version;
    writeFileSync(`${directory}/${ticker}-${suffix}.json`, JSON.stringify(mapped, null, 2));
    console.log(ticker, mapped.period.period_start, mapped.period.period_end, mapped.period.filing_reference);
  }
}
main().catch(error => {
  console.error(error instanceof SecRequestError ? error.message : "Public SEC capture failed before mapping completed");
  process.exitCode = 1;
});
