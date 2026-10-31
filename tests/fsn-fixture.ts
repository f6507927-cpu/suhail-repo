import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { mapAnnual } from "../src/ingest/sec/annual";
import type { CompanyFacts, Retrieval } from "../src/ingest/sec/types";
import definitions from "./fixtures/sec-fsn/targets.json";

export const fsnFixture = (file: string) => readFileSync(`tests/fixtures/sec-fsn/${file}`, "utf8");
export const fsnRetrieval: Retrieval = { url: "https://www.sec.gov/files/dera/data/financial-statement-notes-data-sets/2025q4_notes.zip",
  retrieved_at: "2026-10-23T00:00:00.000Z", is_demo: true, is_synthetic: true };
export function fsnCompany(index = 0): CompanyFacts {
  const d = definitions[index];
  return { cik: Number(d.cik), entityName: `Synthetic ${d.ticker}`, facts: { "us-gaap": {
    Revenues: { units: { USD: [{ start: d.start, end: d.end, val: 1000, accn: d.accn, filed: d.filed, form: "10-K", fp: "FY", fy: d.fy }] } },
  } } };
}
export const fsnTargets = definitions.map((d, i) => ({ ticker: d.ticker, cik: d.cik, mapped: mapAnnual(fsnCompany(i), fsnRetrieval) }));
export function fsnZip(tables: Record<string, string> = {
  "num.tsv": fsnFixture("num.tsv"), "sub.tsv": fsnFixture("sub.tsv"), "txt.tsv": "unparsed unrelated text",
}) {
  return zipSync(Object.fromEntries(Object.entries(tables).map(([name, text]) => [name, strToU8(text)])));
}
export function fsnResponse(bytes = fsnZip()) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      // Split through ZIP headers, UTF-8 codepoints and TSV lines.
      for (let i = 0; i < bytes.length; i += 17) controller.enqueue(bytes.slice(i, i + 17));
      controller.close();
    },
  }));
}
