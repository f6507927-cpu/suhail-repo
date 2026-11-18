import "server-only";
import { z } from "zod";
import { parseEnv } from "./shared";

const schema = z.object({
  LLM_MODEL: z.string().trim().min(1),
  AI_RESEARCH_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive(),
  AI_RESEARCH_MAX_INPUT_TOKENS: z.coerce.number().int().positive(),
});
/** D-187: lazy configuration; only the real provider module reads the key. */
export function getResearchEnv() {
  return parseEnv("Research", schema);
}
