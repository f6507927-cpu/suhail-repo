import { countTokens } from "@anthropic-ai/tokenizer";
import { buildPrompt } from "../../src/lib/research/prompt";
import { legacyPrompt } from "../../tests/fixtures/research/legacy-prompt";
import { fixturePackets } from "../../tests/fixtures/research/packets";
import { assertOfflineResearch } from "../../src/ai/research/offline";
assertOfflineResearch(Object.keys(process.env));
const request = { packet: fixturePackets[0], guidance: "Keep the description brief", max_input_tokens: 100000, max_output_tokens: 2000 };
const before = legacyPrompt(request), after = buildPrompt(request);
function measure(prompt: typeof before) {
  return { tokens: countTokens(prompt.system + "\n" + prompt.user),
    bytes: Buffer.byteLength(prompt.system + "\n" + prompt.user) };
}
console.log(JSON.stringify({ fixture: request.packet.security.ticker, before: measure(before), after: measure(after),
  method: "@anthropic-ai/tokenizer 0.0.4, offline legacy encoding; system + user text",
  caveat: "Measured reference-token counts, only a rough estimate for Claude 3+; excludes API framing/output schema. No provider request." }, null, 2));
