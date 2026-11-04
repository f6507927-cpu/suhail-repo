import { isDeepStrictEqual } from "node:util";
import type { AnalystCase } from "./contracts";

/** D-156: only append case definitions before their test gate is passed. */
export function canAppendAnalystCases(stage: string, productionEnabled: boolean) {
  return !productionEnabled && ["draft", "source_verified", "rules_normalized"].includes(stage);
}

export function missingAnalystCases(existing: AnalystCase[], candidates: AnalystCase[]) {
  const merged = structuredClone(existing);
  for (const candidate of candidates) {
    if (!merged.some(c => c.name === candidate.name ||
      (isDeepStrictEqual(c.inputs, candidate.inputs) && isDeepStrictEqual(c.expected, candidate.expected)))) merged.push(candidate);
  }
  return { cases: merged, added: merged.length - existing.length };
}
