import { assertOfflineResearch } from "../../src/ai/research/offline";
import { validationReport, type ValidationSettings } from "../../src/ai/research/validators";
import { fixturePackets, FIXTURE_CLOCK } from "../../tests/fixtures/research/packets";
import { NEGATIVE_CASES, recordedOutput } from "../../tests/fixtures/research/outputs";
import rubric from "../../tests/fixtures/research/rubric.json";
import hashes from "../../tests/fixtures/research/hashes.json";
import { groundingRegressionFixtures } from "../../tests/fixtures/research/grounding-regressions";
import { RecordedResearchClient } from "../../src/lib/research/recorded-client";
import { generateResearch } from "../../src/lib/research/generate";
import { handwrittenModel } from "../../tests/fixtures/research/outputs";

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
for (const fixture of groundingRegressionFixtures()) {
  const blocks = validationReport(fixture.draft, fixture.packet, settings).issues.filter(i => i.severity === "block");
  const passed = fixture.expected ? blocks.some(i => i.check === fixture.expected) : blocks.length === 0;
  if (!passed) regressions++;
  console.log(`grounding regression ${fixture.id}: ${passed ? "PASS" : "FAIL"} (${fixture.expected ? "must block" : "must remain valid"})`);
}
if (regressions) { console.error(`Fixture evaluation regressions: ${regressions}`); process.exitCode = 1; }

// D-216: exercise the same generation/retry/validation interface as P2, with
// recordings only. No SDK import, environment value or network dependency.
async function evaluateRecordedClient() {
  let accepted = 0;
  for (const packet of fixturePackets) {
    const client = new RecordedResearchClient([{
      text: JSON.stringify(handwrittenModel(packet)), model: "recorded-fixture",
      model_version: "handwritten-v1", stop_reason: "end_turn", input_tokens: 100, output_tokens: 100,
    }]);
    const result = await generateResearch(client, { packet, guidance: "", max_input_tokens: 1000, max_output_tokens: 1000 },
      { reserve: async () => true, settle: async () => {} }, settings);
    if (result.state === "generated" && !result.issues.some(i => i.severity === "block")) accepted++;
  }
  console.log(JSON.stringify({ path: "P2 RecordedResearchClient", accepted, total: fixturePackets.length, usefulness: "human-scored" }));
  if (accepted !== fixturePackets.length) process.exitCode = 1;
}
evaluateRecordedClient().catch(() => { console.error("Recorded-client evaluation failed"); process.exitCode = 1; });
