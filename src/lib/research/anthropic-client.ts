import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { researchOutputFormat } from "./provider-format";
import { assertPacketPrivacy } from "../../ai/research/privacy";
import { validateGuidance } from "../../ai/research/validators";
import { getResearchEnv } from "../../env/research";
import { ARABIC_GENERATION_APPROVED, buildPrompt } from "./prompt";
import type { ModelResult, ResearchModelClient, ResearchRequest } from "./contracts";

/** D-187: no automatic SDK retries; generation owns the single structural retry.
 * API/SDK shape checked 2026-11-18:
 * https://platform.claude.com/docs/en/build-with-claude/structured-outputs
 * @anthropic-ai/sdk 1.10.0: messages.create output_config.format, zodOutputFormat.
 */
export class AnthropicResearchClient implements ResearchModelClient {
  async generate(request: ResearchRequest): Promise<ModelResult> {
    if (process.env.NODE_ENV === "test" || process.env.VITEST || process.env.CI)
      throw new Error("Real research providers are forbidden in tests and CI");
    if (!ARABIC_GENERATION_APPROVED) throw new Error("Arabic research prompt and safety list await human approval (O-13)");
    const env = getResearchEnv();
    // Only this file reads the secret; never include it in returned data or errors.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey?.trim()) throw new Error("Research environment validation failed: ANTHROPIC_API_KEY");
    assertPacketPrivacy(request.packet);
    if (validateGuidance(request.guidance).length) throw new Error("Invalid analyst guidance");
    const prompt = buildPrompt(request);
    const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 90_000 });
    const messages = [{ role: "user" as const, content: prompt.user }];
    const output_config = { format: researchOutputFormat() };
    const count = await client.messages.countTokens({ model: env.LLM_MODEL, system: prompt.system, messages, output_config });
    if (count.input_tokens > request.max_input_tokens) throw new Error("Research input token ceiling exceeded");
    const response = await client.messages.create({
      model: env.LLM_MODEL, max_tokens: Math.min(env.AI_RESEARCH_MAX_OUTPUT_TOKENS, request.max_output_tokens),
      system: prompt.system, messages,
      // No tools. Omit temperature for models whose API rejects sampling controls;
      // explicit known legacy model families retain D-25's temperature zero.
      ...(/^claude-(?:3[-.]|sonnet-4(?:-|$)|opus-4(?:-|$)|haiku-4-5)/.test(env.LLM_MODEL) ? { temperature: 0 } : {}),
      output_config,
    });
    return { text: response.content.filter(block => block.type === "text").map(block => block.text).join(""),
      model: env.LLM_MODEL, model_version: response.model, stop_reason: response.stop_reason ?? "unknown",
      input_tokens: response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0),
      output_tokens: response.usage.output_tokens };
  }
}
