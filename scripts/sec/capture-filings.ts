/** Public evidence only; never imports application/database modules. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SecClient, SecRequestError } from "../../src/ingest/sec/client";
const directory = "generated-artifacts/sec-launch";
const client = new SecClient();
async function main() {
  for (const ticker of ["AAPL", "MSFT", "AVGO", "CSCO", "QCOM", "NFLX", "COST", "HD", "AMD", "TXN", "PEP", "LLY", "ORCL", "JNJ", "XOM"]) {
    const facts = JSON.parse(readFileSync(`${directory}/${ticker}.json`, "utf8"));
    const mapped = JSON.parse(readFileSync(`${directory}/${ticker}-before.json`, "utf8"));
    const { data } = await client.submissions(facts.cik);
    const recent = data.filings.recent;
    const i = recent.accessionNumber.indexOf(mapped.period.filing_reference);
    if (i < 0) throw new Error("Selected annual filing missing from recent submissions");
    const document = String(recent.primaryDocument[i]);
    const response = await client.filing(facts.cik, mapped.period.filing_reference, document);
    writeFileSync(`${directory}/${ticker}-filing.html`, response.data);
    writeFileSync(`${directory}/${ticker}-filing-metadata.json`, JSON.stringify({
      ...response.retrieval, accession: mapped.period.filing_reference, document,
      sha256: createHash("sha256").update(response.data).digest("hex"),
    }, null, 2));
    console.log(ticker, document, "captured");
  }
}
main().catch(error => {
  console.error(error instanceof SecRequestError ? error.message : "Public filing capture could not complete");
  process.exitCode = 1;
});
