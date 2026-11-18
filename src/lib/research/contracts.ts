import type { ResearchPacket, ValidationIssue } from "../../ai/research/contracts";
import type { ResearchDraft } from "../../ai/research/draft";

export const RESEARCH_STATES = ["requested", "generated", "failed", "in_review", "changes_requested", "edited", "approved", "rejected", "published", "updated", "withdrawn"] as const;
export type ResearchState = typeof RESEARCH_STATES[number];
export const EDIT_REASONS = ["tone", "accuracy", "too strong", "missing risk", "citation", "compliance wording", "other"] as const;
export const CHECKLIST = ["figures_checked", "risks_adequate", "wording_compliant", "shariah_context_correct", "disclosure_present", "analyst_view_confirmed"] as const;
export type Checklist = Record<typeof CHECKLIST[number], boolean>;
export interface ResearchRequest {
  packet: ResearchPacket;
  guidance: string;
  max_input_tokens: number;
  max_output_tokens: number;
}
export interface ModelResult {
  text: string;
  model: string;
  model_version: string;
  stop_reason: string;
  input_tokens: number;
  output_tokens: number;
}
export interface ResearchModelClient {
  /** No model network call in tests: use RecordedResearchClient. */
  generate(request: ResearchRequest): Promise<ModelResult>;
}
export interface GenerationResult {
  state: "generated" | "failed";
  draft: ResearchDraft | null;
  issues: ValidationIssue[];
  reason: string | null;
  attempts: number;
  input_tokens: number;
  output_tokens: number;
  model: string | null;
  model_version: string | null;
}
export interface ResearchBudget {
  reserve(tokens: number): Promise<boolean>;
  settle(reserved: number, used: number): Promise<void>;
}
