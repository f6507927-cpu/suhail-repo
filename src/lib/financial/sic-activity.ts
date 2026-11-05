import type { Segment } from "../../engine/types";

export const SIC_MAPPING_LABEL = "Suhail SIC mapping v1 — pending analyst review";
export const SIC_PROHIBITED = {
  conventional_finance: [6020, 6021, 6022, 6029, 6035, 6036, 6099, 6199, 6200, 6211, 6221],
  interest_based_lending: [6111, 6141, 6153, 6159, 6162, 6163, 6172],
  insurance_conventional: [6311, 6321, 6324, 6331, 6351, 6361, 6399, 6411],
  alcohol: [2082, 2084, 2085, 5180, 5813],
  tobacco: [2100, 2111, 2121, 2131, 5194],
} as const;
export const SIC_AMBIGUOUS = [
  7011, 7990, 7993, 2011, 7812, 7819, 7822, 7829, 7830, 7841, 4832, 4833, 4841, 2711, 6282, 6798, 6770,
] as const;

/** Explicit founder table; no description/fuzzy matching or sector inference. */
export function sicActivity(code: number, sourceId: string): Segment | null {
  if (!Number.isInteger(code) || code < 100 || code > 9999 || !sourceId) return null;
  const category = Object.entries(SIC_PROHIBITED).find(([, codes]) => (codes as readonly number[]).includes(code))?.[0]
    ?? ((SIC_AMBIGUOUS as readonly number[]).includes(code) ? "unclassified" : "generic_permissible");
  return {
    segmentName: `${SIC_MAPPING_LABEL}; SEC SIC code ${code}`,
    activityCategory: category, revenueAmount: null, revenueShare: 1,
    inputState: "estimated", confidenceTier: "Estimated", sourceId,
  };
}
