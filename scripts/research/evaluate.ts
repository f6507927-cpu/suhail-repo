import { assertOfflineResearch } from "../../src/ai/research/offline";
import { validationReport, type ValidationSettings } from "../../src/ai/research/validators";
import { fixturePackets, FIXTURE_CLOCK } from "../../tests/fixtures/research/packets";
import { NEGATIVE_CASES, recordedOutput } from "../../tests/fixtures/research/outputs";
import rubric from "../../tests/fixtures/research/rubric.json";
import hashes from "../../tests/fixtures/research/hashes.json";

assertOfflineResearch(Object.keys(process.env));
if (fixturePackets.some(p => hashes[p.security.ticker as keyof typeof hashes] !== p.packet_hash))
  throw new Error("Synthetic packet fixture changed; review the frozen evidence before evaluating");
const settings: ValidationSettings = { now: FIXTURE_CLOCK, max_packet_age_days: 30,
  max_financial_age_days: 550, known_issuers: fixturePackets.map(p => p.security.name) };
let regressions = 0;
console.log("SYNTHETIC FIXTURES ONLY — no issuer research, provider, network or database");
console.log(`Rubric: ${rubric.version}; usefulness: human-scored, not yet scored`);
for (const version of ["deliberately-bad-v0", "handwritten-v1"] as const) {
  const totals = Object.fromEntries(Object.keys(rubric.automatic_dimensions).map(key => [key, 0]));
  let accepted = 0;
  for (const [index, packet] of fixturePackets.entries()) {
    const report = validationReport(recordedOutput(packet, version, index), packet, settings);
    const blocks = report.issues.filter(i => i.severity === "block");
    if (!blocks.length) accepted++;
    for (const [dimension, checks] of Object.entries(rubric.automatic_dimensions))
      if (!blocks.some(i => checks.includes(i.check))) totals[dimension]++;
    const expected = NEGATIVE_CASES[index % NEGATIVE_CASES.length].check;
    if (version === "handwritten-v1" ? blocks.length : !blocks.some(i => i.check === expected)) regressions++;
    console.log(`${version} ${packet.security.ticker}: ${blocks.length ? "blocked" : "valid"} [${[...new Set(blocks.map(i => i.check))].join(", ")}]`);
  }
  console.log(JSON.stringify({ version, accepted, total: fixturePackets.length, scores: totals,
    usefulness: rubric.usefulness.scores[version], validator_version: validationReport(recordedOutput(fixturePackets[0], version, 0), fixturePackets[0], settings).validator_version }));
}
if (regressions) { console.error(`Fixture evaluation regressions: ${regressions}`); process.exitCode = 1; }
