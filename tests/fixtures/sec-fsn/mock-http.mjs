// Child-process CLI test only. Unknown network requests fail; no runtime bypass.
import { readFileSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";
const root = new URL("./", import.meta.url);
const text = name => readFileSync(new URL(name, root), "utf8");
const targets = JSON.parse(text("targets.json"));
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url === "https://www.sec.gov/files/company_tickers_exchange.json")
    return Response.json({ fields: ["ticker", "cik"], data: targets.map(t => [t.ticker, Number(t.cik)]) });
  const target = targets.find(t => url === `https://data.sec.gov/api/xbrl/companyfacts/CIK${t.cik.padStart(10, "0")}.json`);
  if (target) return Response.json({
    cik: Number(target.cik), entityName: "Synthetic CLI fixture", facts: { "us-gaap": {
      Revenues: { units: { USD: [{ start: target.start, end: target.end, val: 1000,
        accn: target.accn, filed: target.filed, form: "10-K", fp: "FY", fy: target.fy }] } },
    } },
  });
  if (url === "https://www.sec.gov/data-research/sec-markets-data/financial-statement-notes-data-sets")
    return new Response(text("catalog.html"));
  if (/^https:\/\/www\.sec\.gov\/files\/dera\/data\/financial-statement-notes-data-sets\/(?:2025q4|2026_07|2026_02)_notes\.zip$/.test(url))
    return new Response(zipSync({ "num.tsv": strToU8(text("num.tsv")), "sub.tsv": strToU8(text("sub.tsv")) }));
  throw new Error("Fixture CLI forbids all unmocked network requests");
};
