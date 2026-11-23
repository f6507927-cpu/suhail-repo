import { assembleDraft, modelDraftSchema, DRAFT_SCHEMA_VERSION, screeningContext, proseFields, inlineCiteIds } from "../../ai/research/draft";
import { validateGuidance, validateResearchDraft, type ValidationSettings } from "../../ai/research/validators";
import type { GenerationResult, ResearchBudget, ResearchModelClient, ResearchRequest } from "./contracts";

/** D-187/D-188: provider work occurs outside all database transactions. */
export async function generateResearch(client: ResearchModelClient, request: ResearchRequest,
  budget: ResearchBudget, settings: ValidationSettings): Promise<GenerationResult> {
  const result: GenerationResult = { state: "failed", draft: null, issues: [], reason: null,
    attempts: 0, input_tokens: 0, output_tokens: 0, model: null, model_version: null };
  const guidanceIssues = validateGuidance(request.guidance);
  if (guidanceIssues.length) return { ...result, issues: guidanceIssues, reason: "invalid_guidance" };
  const reservation = request.max_input_tokens + request.max_output_tokens;
  if (!Number.isSafeInteger(reservation) || request.max_input_tokens <= 0 || request.max_output_tokens <= 0)
    throw new Error("Positive token ceilings are required");
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!await budget.reserve(reservation)) return { ...result, reason: "budget_reached" };
    let used = 0;
    try {
      result.attempts++;
      const response = await client.generate(request);
      used = response.input_tokens + response.output_tokens;
      if (!Number.isSafeInteger(used) || response.input_tokens < 0 || response.output_tokens < 0)
        throw new Error("Invalid provider usage");
      result.input_tokens += response.input_tokens;
      result.output_tokens += response.output_tokens;
      result.model = response.model;
      result.model_version = response.model_version;
      if (response.input_tokens > request.max_input_tokens || response.output_tokens > request.max_output_tokens)
        return { ...result, reason: "token_ceiling_exceeded" };
      if (response.stop_reason === "refusal") return { ...result, reason: "provider_refusal" };
      let parsed: ReturnType<typeof modelDraftSchema.safeParse>;
      try { parsed = modelDraftSchema.safeParse(JSON.parse(response.text)); }
      catch { parsed = modelDraftSchema.safeParse(null); }
      if (response.stop_reason === "max_tokens" || !parsed.success) {
        result.reason = "structural_failure";
        continue;
      }
      // Content problems, including invalid references, are not structural retries.
      try { result.draft = assembleDraft(parsed.data, request.packet); }
      catch {
        // Preserve the original model prose/references for analyst inspection.
        // Never invent a source for an unknown citation; the unchanged P1
        // validator reports it as a block, without retrying content failures.
        const ids = [...new Set(proseFields(parsed.data).flatMap(field => [
          ...field.cites, ...inlineCiteIds(field.text.ar), ...inlineCiteIds(field.text.en),
        ]))];
        result.draft = { ...parsed.data, draft_schema_version: DRAFT_SCHEMA_VERSION,
          packet_hash: request.packet.packet_hash, shariah_context: screeningContext(request.packet),
          citations: ids.flatMap(id => {
            const item = request.packet.items.find(item => item.id === id);
            return item ? [{ item_id: id, source_id: item.source.id, url: item.source.url }] : [];
          }) };
      }
      result.issues = validateResearchDraft(result.draft, request.packet, { ...settings, guidance: request.guidance });
      return { ...result, state: "generated", reason: null };
    } catch {
      // Unknown transport usage retains the reservation conservatively.
      if (used === 0) used = reservation;
      return { ...result, reason: "provider_failed" };
    } finally { await budget.settle(reservation, used); }
  }
  return result;
}
