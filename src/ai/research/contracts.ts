import { z } from "zod";
import type { StatusReason, Status } from "../../engine/types";

export const PACKET_VERSION = "research-packet-1";
export const VALIDATOR_VERSION = "research-validator-1";
export const dateSchema = z.iso.date();
export const clockSchema = z.iso.datetime();
const key = z.string().regex(/^[A-Za-z0-9_-]+$/);
const tier = z.enum(["Verified", "Calculated", "Estimated", "AI Interpretation"]);
export const statusSchema = z.enum([
  "passes_selected_methodology", "requires_review", "fails_selected_methodology", "insufficient_data",
]);
export const sourceSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), url: z.url().nullable(),
  accession: z.string().nullable(), is_synthetic: z.boolean(), production_blocked: z.boolean(),
});
export type Source = z.infer<typeof sourceSchema>;
const evidence = z.object({
  source: sourceSchema, confidence_tier: tier, date: dateSchema,
});
const fact = evidence.extend({
  field: key, value: z.number().finite().nullable(), unit: z.string().min(1), unavailable_reason: z.string().optional(),
});
export const runSchema = evidence.extend({
  methodology: key, methodology_label: z.string().min(1), version: z.string().min(1),
  production_enabled: z.boolean(), run_at: z.iso.datetime(), data_as_of: dateSchema,
  status: statusSchema, engine_version: z.string(), calculation_version: z.string(),
  immutable_hash: z.string().min(1),
  criteria: z.array(z.object({
    id: key, result: z.enum(["pass", "fail", "borderline", "unknown"]),
    ratio: z.number().finite().nullable(), threshold: z.number().finite().nullable(),
    numerator: z.number().finite().nullable(), denominator: z.number().finite().nullable(),
    unit: z.string().min(1), numerator_unit: z.string().min(1), denominator_unit: z.string().min(1),
  })),
  unknowns: z.array(z.object({ id: key, explanation: z.string().min(1) })),
  reasons: z.array(z.object({
    kind: z.enum(["failure", "borderline", "criterion_unknown", "blocking_unknown", "review_unknown", "counts"]),
    criterionId: z.string().nullable(), label: z.string(), field: z.string().nullable(),
    ratio: z.number().finite().nullable(), threshold: z.number().finite().nullable(),
    thresholdUnit: z.enum(["percent_of_total_revenue", "percent_of_total_assets", "percent_of_market_cap", "boolean", "absolute"]).nullable(),
    reasonCode: z.enum(["boolean_positive", "boolean_nonpositive", "within_margin", "max_within_limit", "max_exceeded", "min_met", "min_not_met", "denominator_unavailable", "denominator_nonpositive", "numerator_unavailable", "no_segments", "shares_unavailable", "unclassified_primary", "primary_tied", "primary_prohibited", "primary_permissible", "evaluator_unregistered", "stale_data", "criterion_counts"]),
    borderlineCount: z.number().int().nonnegative().optional(), unknownCount: z.number().int().nonnegative().optional(),
  })),
});
export const packetInputSchema = z.object({
  security: z.object({
    id: key, ticker: key, name: z.string().min(1), sic: z.string().nullable(),
    activity: z.string().nullable(), covered: z.boolean(), in_universe: z.boolean(),
    ...evidence.shape,
  }),
  periods: z.array(z.object({
    id: key, annual: z.boolean(), period_end: dateSchema, reported_date: dateSchema,
    facts: z.array(fact),
  })),
  runs: z.array(runSchema),
  filings: z.array(evidence.extend({ id: key, period_end: dateSchema, reported_date: dateSchema })).optional(),
  prices: z.array(evidence.extend({
    month_end_for: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    close: z.number().finite().positive(), currency: z.string().regex(/^[A-Z]{3}$/),
  })),
});
export type PacketInput = z.infer<typeof packetInputSchema>;
export type StoredRun = z.infer<typeof runSchema>;
export type Bilingual = { ar: string; en: string };
export type ItemValue = string | number | boolean | null;
export interface PacketItem {
  id: string;
  kind: "identity" | "financial" | "screening" | "price" | "derived";
  value: ItemValue;
  unit: string;
  date: string;
  period: string | null;
  source: Source;
  confidence_tier: z.infer<typeof tier>;
  unavailable: string | null;
  derivation: { formula: string; inputs: string[]; rounding: string } | null;
}
export interface PacketRun {
  methodology: string; label: string; version: string; status: Status;
  data_as_of: string; run_at: string; immutable_hash: string;
  engine_version: string; calculation_version: string;
  reasons: StatusReason[];
}
export interface ResearchPacket {
  packet_schema_version: string;
  built_at: string;
  packet_hash: string;
  security: { id: string; ticker: string; name: string; covered: boolean; in_universe: boolean };
  items: PacketItem[];
  sections: Record<PacketItem["kind"], string[]>;
  screenings: PacketRun[];
  periods: { id: string; period_end: string; reported_date: string }[];
  filings?: { id: string; period_end: string; reported_date: string }[];
}
/** D-189: P2 supplies IO; this module provides a contract, not an implementation. */
export interface ResearchPacketLoader {
  loadRows(securityId: string): Promise<PacketInput>;
}
export interface ValidationIssue {
  check: string; severity: "block" | "warn"; message: string; location: string;
}
