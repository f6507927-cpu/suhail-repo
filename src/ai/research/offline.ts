/** P1/D-187: inspect names only; a real credential is never read or needed. */
export function assertOfflineResearch(environmentNames: readonly string[], provider = "fixtures") {
  if (provider !== "fixtures") throw new Error("P1 permits fixture providers only");
  if (environmentNames.some(name => /^(?:ANTHROPIC|OPENAI|GOOGLE|GEMINI|COHERE|MISTRAL|AI_RESEARCH).*API_KEY$/i.test(name)))
    throw new Error("Provider API keys must be absent during fixture research evaluation");
}
