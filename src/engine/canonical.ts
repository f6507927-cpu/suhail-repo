import { createHash } from "node:crypto";
import type { JsonValue } from "./types";

/** Compare Unicode code points, including astral characters; never locale order. */
export function compareCodePoints(a: string, b: string): number {
  const aa = Array.from(a, (c) => c.codePointAt(0)!);
  const bb = Array.from(b, (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    if (aa[i] !== bb[i]) return aa[i] - bb[i];
  }
  return aa.length - bb.length;
}

/** Undefined is dropped (also from arrays); null and remaining array order stay. */
export function canonicalize(value: JsonValue | undefined): JsonValue | undefined {
  // D-125: new unrounded decisions must replay from the exact numeric inputs.
  // Only explicit engine-1.0.1 payloads retain ten-decimal canonicalization.
  // Unversioned objects, root arrays/scalars and future versions stay exact.
  const exactNumbers = !(value !== null && typeof value === "object" && !Array.isArray(value) && value.engine_version === "engine-1.0.1");
  return normalize(value, exactNumbers);
}
function normalize(value: JsonValue | undefined, exactNumbers: boolean): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") {
    const rounded = exactNumbers ? value : Number(value.toFixed(10));
    return Object.is(rounded, -0) ? 0 : rounded;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => normalize(item, exactNumbers) as JsonValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort(compareCodePoints)
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, normalize(value[key], exactNumbers)]),
    );
  }
  return value;
}

export function hash(payload: JsonValue): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

/** No lookup of live evidence; D-43 preserves independent historic verification. */
export function verify(payload: JsonValue, storedHash: string): boolean {
  return hash(payload) === storedHash;
}
