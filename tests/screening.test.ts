import { describe, expect, it, vi } from "vitest";
import { input, fact } from "../src/engine/__fixtures__/synthetic";
import { screen } from "../src/engine/screen";
import * as engine from "../src/engine/screen";
import { hash } from "../src/engine/canonical";
import { inputFromPayload, verifyStoredRun, diff } from "../src/screening/verify";
import type { HashPayload } from "../src/db/schema/types";
vi.mock("server-only", () => ({}));

describe("stored screening payload replay", () => {
  it("dispatches supported historical and current precision under their own rules", () => {
    const i = input({ facts: [fact("interest_bearing_debt", 30.004), fact("total_assets", 100)] });
    i.methodologyVersion.criteria[0].threshold = 30;
    i.methodologyVersion.criteria[0].borderlineMargin = null;
    for (const version of ["engine-1.0.1", "engine-1.0.2"]) {
      i.facts[0].value = version === "engine-1.0.1" ? 30.004 : 30.000000000001;
      const r = screen({ ...i, engineVersion: version,
        calculationVersion: version === "engine-1.0.1" ? "calc-2026.10.3" : "calc-2026.10.4" });
      expect(r.criteria[0].result).toBe(version === "engine-1.0.1" ? "pass" : "fail");
      expect(verifyStoredRun({ immutable_hash: r.immutableHash, hash_payload: r.hashPayload as HashPayload }))
        .toMatchObject({ valid: true, hashMatches: true, replaySupported: true, replayMatches: true });
    }
  });
  const output = screen(input({ calculationVersion: "calc-2026.10.3" }));
  const stored = () => ({ immutable_hash: output.immutableHash, hash_payload: structuredClone(output.hashPayload) as HashPayload });
  it("roundtrips complete evidence and outputs without current data", () => {
    expect(screen(inputFromPayload(output.hashPayload)).hashPayload).toEqual(output.hashPayload);
    expect(verifyStoredRun(stored())).toMatchObject({ valid: true, hashMatches: true, replayMatches: true, differences: [] });
  });
  it("reports a hash mismatch as well as the changed output path", () => {
    const run = stored();
    run.hash_payload.outputs.status = "insufficient_data";
    expect(verifyStoredRun(run)).toMatchObject({ valid: false, hashMatches: false, replayMatches: false });
    expect(verifyStoredRun(run).differences.some(d => d.path === "$.outputs.status")).toBe(true);
  });
  it("detects a forged output even if the attacker recomputes the outer hash", () => {
    const run = stored();
    run.hash_payload.outputs.confidence = "Low";
    run.immutable_hash = hash(run.hash_payload);
    expect(verifyStoredRun(run)).toMatchObject({ valid: false, hashMatches: true, replayMatches: false });
  });
  it("returns detailed replay failure rather than throwing on malformed input", () => {
    const run = stored();
    run.hash_payload.facts = null as unknown as HashPayload["facts"];
    expect(verifyStoredRun(run).differences.some(d => d.path === "$.replay")).toBe(true);
  });
  it.each([true, false])("skips current-engine replay for foreign versions (intact hash: %s)", (intact) => {
    const run = stored();
    run.hash_payload.engine_version = "engine-0.9.0";
    // Intentionally not reconstructable by today's engine.
    run.hash_payload.facts = null as unknown as HashPayload["facts"];
    run.immutable_hash = hash(run.hash_payload);
    if (!intact) run.hash_payload.outputs.confidence = "Low";
    const replay = vi.spyOn(engine, "screen");
    try {
      const result = verifyStoredRun(run);
      expect(replay).not.toHaveBeenCalled();
      expect(result).toMatchObject({ valid: intact, hashMatches: intact, replaySupported: false,
        replayMatches: null, engineVersion: "engine-0.9.0" });
      expect(result.differences.map(d => d.path)).toEqual(intact ? [] : ["$.immutable_hash"]);
    } finally { replay.mockRestore(); }
  });
  it("recurses to the changed array cell and ignores object key order", () => {
    expect(diff({ a: 1, b: [2] }, { b: [3], a: 1 })).toEqual([{ path: "$.b.0", expected: 2, actual: 3 }]);
    expect(diff({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });
});
