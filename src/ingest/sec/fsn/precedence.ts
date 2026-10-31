import type { MappedFact } from "../types";

/** Rechecked under the existing company transaction lock, before source writes. */
export function retainCurrent(incoming: MappedFact, current?: { value: string | number | null; origin: string; protected_current: boolean }) {
  if (!current) return false;
  if (incoming.adapter === "sec_fsn")
    return current.protected_current || (current.value !== null && current.origin !== "sec_fsn");
  return incoming.value === null && current.origin === "sec_fsn" && current.value !== null;
}
