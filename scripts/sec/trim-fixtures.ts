/**
 * Offline fixture generation ONLY. Downloaded responses live temporarily outside
 * the repo. No imports, DB writes, SEC calls, seeds or raw-response archiving.
 * Usage: pnpm exec tsx scripts/sec/trim-fixtures.ts /tmp/sec-checkpoint
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { candidates } from "../../src/ingest/sec/mapping";
import type { CompanyFacts, Fixture } from "../../src/ingest/sec/types";

const input = process.argv[2];
if (!input) throw new Error("Provide the temporary SEC download directory");
const output = "tests/fixtures/sec";
mkdirSync(output, { recursive: true });
for (const name of ["aapl", "msft", "jpm"]) {
  const raw = readFileSync(resolve(input, `${name}.json`));
  const data = JSON.parse(raw.toString()) as CompanyFacts;
  const retrieval = JSON.parse(readFileSync(resolve(input, `${name}-metadata.json`), "utf8"));
  const facts: CompanyFacts["facts"] = {};
  // Retain the bank-specific candidate as evidence, NOT as a new mapping rule.
  const tags = [...new Set([...Object.values(candidates).flat(), "RevenuesNetOfInterestExpense"])];
  for (const tag of tags) {
    const [ns, key] = tag.includes(":") ? tag.split(":") : ["us-gaap", tag];
    const concept = data.facts[ns]?.[key];
    if (!concept) continue;
    // All units, forms and dates in the retained window, including quarters,
    // duplicates, comparative fy metadata and newer DEI cover-page instants.
    const units = Object.fromEntries(Object.entries(concept.units).map(([unit, observations]) =>
      [unit, observations.filter(v => v.end >= "2022-01-01")]).filter(([, rows]) => rows.length));
    (facts[ns] ??= {})[key] = { ...concept, units };
  }
  const fixture: Fixture = { metadata: { ...retrieval, is_synthetic: false, is_demo: false,
    original_sha256: createHash("sha256").update(raw).digest("hex"),
    trimming: "Requested mapping tags plus RevenuesNetOfInterestExpense; all units/forms with end >= 2022-01-01; observations copied unchanged. An empty units object means the original concept exists only outside the retained window.",
  }, companyfacts: { cik: data.cik, entityName: data.entityName, facts } };
  writeFileSync(`${output}/${name}.json`, JSON.stringify(fixture, null, 2) + "\n");
}
