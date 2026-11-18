import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { bilingualSchema, modelDraftSchema } from "../../ai/research/draft";

/** D-216: SDK 1.10 cannot transform Zod's tuple schema. The transport accepts
 * an array; the unchanged original schema still enforces exactly three short
 * lines on return, including its length limits, before content validation.
 */
export function researchOutputFormat() {
  return zodOutputFormat(modelDraftSchema.extend({ plain_summary: z.array(bilingualSchema) }));
}
