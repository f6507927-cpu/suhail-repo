import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { goldenInput, input, segment } from "./__fixtures__/synthetic";
import { canonicalize, screen, verify, CALCULATION_VERSION, ENGINE_VERSION, type EngineInput, type JsonObject, type JsonValue } from "./index";
import { compareCodePoints, hash } from "./canonical";

describe("canonical JSON and D-89's evidence-complete §7.4 projection", () => {
  it("sorts recursive keys, drops undefined, retains null, preserves array order and precision", () => {
    const original = {
      z: null, a: { z: -0, b: 1.123456789012, a: undefined },
      values: [3, { z: 2, a: 1 }, undefined, null, -0], omitted: undefined,
    };
    expect(JSON.stringify(canonicalize(original))).toBe('{"a":{"b":1.123456789012,"z":0},"values":[3,{"a":1,"z":2},null,0],"z":null}');
    expect(Object.is((canonicalize(-0)), -0)).toBe(false);
    expect(Object.is(canonicalize(-0.00000000001), -0)).toBe(false);
    expect(canonicalize(-0.00000000001)).toBe(-0.00000000001);
    expect(canonicalize(undefined)).toBeUndefined();
    expect(canonicalize("text")).toBe("text");
    expect(canonicalize(true)).toBe(true);
    expect(canonicalize(null)).toBeNull();
    expect(original.values[2]).toBeUndefined();
  });
  it("rounds only explicit historical payloads, preserving future, unversioned, array and scalar precision", () => {
    const tiny = 30.00000000001;
    expect(canonicalize({ engine_version: "engine-1.0.1", value: tiny })).toEqual({ engine_version: "engine-1.0.1", value: 30 });
    for (const version of ["engine-1.0.2", "engine-99.0.0"]) {
      expect(canonicalize({ engine_version: version, value: tiny })).toEqual({ engine_version: version, value: tiny });
    }
    expect(canonicalize({ value: tiny })).toEqual({ value: tiny });
    expect(canonicalize([tiny, { engine_version: "engine-1.0.1", value: tiny }])).toEqual([tiny, { engine_version: "engine-1.0.1", value: tiny }]);
    expect(canonicalize(tiny)).toBe(tiny);
  });
  it("orders code points, not locale or UTF-16 code units", () => {
    expect(["😀", "\uE000", "z", "a", "aa", "a"].sort(compareCodePoints)).toEqual(["a", "a", "aa", "z", "\uE000", "😀"]);
    expect(compareCodePoints("aa", "a")).toBeGreaterThan(0);
    expect(compareCodePoints("a", "a")).toBe(0);
    expect(Object.keys(canonicalize({ "😀": 1, "\uE000": 2 }) as JsonObject)).toEqual(["\uE000", "😀"]);
  });
  it("returns only specified fields, sorted facts/segments but unsorted criterion/nested arrays", () => {
    const i = goldenInput("A", "pass");
    i.facts.reverse();
    i.segments.reverse();
    i.methodologyVersion.criteria.reverse();
    const r = screen(i);
    const p = r.hashPayload;
    expect(Object.keys(p)).toEqual([
      "as_of", "calculation_version", "criteria", "engine_version", "facts", "financial_period_end",
      "financial_period_id", "financial_period_label", "methodology_version_id",
      "methodology_version_label", "outputs", "security_id", "segments", "staleness_limit_days",
    ]);
    const facts = p.facts as JsonObject[];
    const segments = p.segments as JsonObject[];
    const criteria = p.criteria as JsonObject[];
    expect(facts.map((f) => f.line_item)).toEqual(i.facts.map((f) => f.lineItem).sort(compareCodePoints));
    expect(segments.map((s) => s.segment_name)).toEqual(i.segments.map((s) => s.segmentName).sort(compareCodePoints));
    expect(Object.keys(facts[0])).toEqual(["confidence_tier", "input_state", "line_item", "source_id", "value"]);
    expect(Object.keys(segments[0])).toEqual(["activity_category", "confidence_tier", "input_state", "revenue_amount", "revenue_share", "segment_name", "source_id"]);
    expect(Object.keys(criteria[0])).toEqual([
      "borderline_margin", "criterion_type", "denominator_definition", "denominator_line_items", "id",
      "label", "numerator_definition", "numerator_line_items", "sort_order", "source_reference",
      "threshold", "threshold_direction", "threshold_unit", "treatment_rule_data",
    ]);
    expect(criteria.map((c) => c.id)).toEqual(i.methodologyVersion.criteria.map((c) => c.id));
    expect(criteria.at(-2)!.treatment_rule_data).toEqual(i.methodologyVersion.criteria.at(-2)!.treatmentRuleData);
    const output = p.outputs as JsonObject;
    expect(Object.keys(output)).toEqual(["confidence", "criteria", "data_adequacy", "status", "status_reasons", "unknowns"]);
    expect(Object.keys((output.criteria as JsonObject[])[0])).toEqual([
      "borderline_margin", "calculation_trace", "confidence_tier", "criterion_id", "criterion_type",
      "denominator", "denominator_definition", "input_states", "label", "numerator", "numerator_definition",
      "ratio", "result", "result_reason_code", "sort_order", "source_ids", "source_reference",
      "threshold", "threshold_direction", "threshold_unit",
    ]);
    expect(r.immutableHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.financialSnapshotId).toBe(`snap_${i.period.id}_${r.immutableHash.slice(0, 12)}`);
    expect(ENGINE_VERSION).toBe("engine-1.0.2");
    expect(CALCULATION_VERSION).toBe("calc-2026.10.6");
  });
  it("D-89: evidence/metadata changes now invalidate the formerly incomplete hash", () => {
    const i = goldenInput("A", "pass");
    const initial = screen(i);
    i.asOf = "2026-10-12"; i.stalenessLimitDays = 1000;
    i.period.label = "Changed period label"; i.methodologyVersion.label = "Changed label";
    i.methodologyVersion.criteria[0].label = "Different trace";
    i.methodologyVersion.criteria[0].numeratorDefinition = "Different definition";
    i.methodologyVersion.criteria[0].sortOrder = 999;
    i.segments[0].confidenceTier = "AI Interpretation";
    expect(screen(i).immutableHash).not.toBe(initial.immutableHash);
    expect(screen(i).criteria[0].confidenceTier).not.toBe(initial.criteria[0].confidenceTier);
    i.asOf = "2030-01-01";
    expect(screen(i).immutableHash).not.toBe(initial.immutableHash); // derived quality/status are hashed
  });
  it("keeps criterion, numerator/denominator and treatment arrays order significant", () => {
    const i = goldenInput("A", "pass");
    const initial = screen(i).immutableHash;
    const variants = [
      (v: EngineInput) => v.methodologyVersion.criteria.reverse(),
      (v: EngineInput) => v.methodologyVersion.criteria[3].numeratorLineItems.reverse(),
      (v: EngineInput) => (v.methodologyVersion.criteria[0].treatmentRuleData.prohibited_categories as string[]).reverse(),
    ];
    for (const mutate of variants) {
      const v = structuredClone(i);
      mutate(v);
      expect(screen(v).immutableHash).not.toBe(initial);
    }
    expect(hash({ nested: [2, 1] })).not.toBe(hash({ nested: [1, 2] }));
  });
  it("verify uses stored payload, not live evidence, and detects tampering", () => {
    const i = input();
    const r = screen(i);
    expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
    expect(verify(JSON.parse(JSON.stringify(r.hashPayload)), r.immutableHash)).toBe(true);
    i.facts[0].value = 90;
    expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
    const altered = structuredClone(r.hashPayload);
    altered.security_id = "tampered";
    expect(verify(altered, r.immutableHash)).toBe(false);
    expect(verify(r.hashPayload, "invalid hash")).toBe(false);
    expect(verify(r.hashPayload, r.immutableHash.toUpperCase())).toBe(false);
    expect(verify(screen(i).hashPayload, r.immutableHash)).toBe(false);
  });
});

describe("fabricated EX-A/EX-B golden results and hashes", () => {
  for (const example of ["A", "B"] as const) {
    for (const outcome of ["pass", "review", "fail", "insufficient"] as const) {
      it(`EX-${example} ${outcome}`, () => {
        const r = screen(goldenInput(example, outcome));
        const statuses = {
          pass: "passes_selected_methodology", review: "requires_review",
          fail: "fails_selected_methodology", insufficient: "insufficient_data",
        };
        expect(r.status).toBe(statuses[outcome]);
        expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
        expect({
          status: r.status, dataAdequacy: r.dataAdequacy, confidence: r.confidence,
          immutableHash: r.immutableHash, financialSnapshotId: r.financialSnapshotId,
          outputs: r.hashPayload.outputs, criteria: r.hashPayload.criteria,
        }).toMatchSnapshot();
      });
    }
  }
  it("EX-B uses its wider activity categories and cash-only numerator", () => {
    const a = goldenInput("A", "pass");
    const b = goldenInput("B", "pass");
    a.segments = b.segments = [segment({ activityCategory: "conventional_media" })];
    expect(screen(a).criteria[0].result).toBe("pass");
    expect(screen(b).criteria[0].result).toBe("fail");
    expect(screen(a).criteria[3].numeratorValue).toBe(12);
    expect(screen(b).criteria[3].numeratorValue).toBe(10);
    expect(screen(b).criteria[2].numeratorValue).toBe(12); // D-44/D-62: exclude lease fixtures
  });
});

/** Test-only key-order permutation; criterion/nested array order is NOT shuffled. */
function reorderKeys(value: JsonValue, seed: number): JsonValue {
  if (Array.isArray(value)) return value.map((v) => v === undefined ? undefined : reorderKeys(v, seed));
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    const offset = Math.abs(seed) % (entries.length || 1);
    const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
    return Object.fromEntries(rotated.map(([k, v]) => [k, v === undefined ? undefined : reorderKeys(v, seed)]));
  }
  return value;
}
describe("fast-check generated reproducibility and tamper properties", () => {
  const values = fc.integer({ min: -100000, max: 100000 }); // mutations are distinguishable at 10 decimal places
  const seeds = fc.integer();
  it("object-key/fact-order/segment-order permutations preserve hashes", () => {
    const factOrder = fc.shuffledSubarray([0, 1, 2, 3, 4, 5, 6, 7], { minLength: 8, maxLength: 8 });
    const segmentOrder = fc.shuffledSubarray([0, 1], { minLength: 2, maxLength: 2 });
    fc.assert(fc.property(values, seeds, factOrder, segmentOrder, (value, seed, factIndices, segmentIndices) => {
      const i = goldenInput("A", "pass");
      i.facts[0].value = value;
      const original = screen(i);
      const reordered = reorderKeys(i as unknown as JsonValue, seed) as unknown as EngineInput;
      reordered.facts = factIndices.map((index) => reordered.facts[index]);
      reordered.segments = segmentIndices.map((index) => reordered.segments[index]);
      expect(screen(reordered).immutableHash).toBe(original.immutableHash);
      expect(hash(reorderKeys(original.hashPayload, seed))).toBe(original.immutableHash);
    }), { numRuns: 150 });
  });
  it("every single fact value/state/tier/source mutation changes hash", () => {
    fc.assert(fc.property(values, fc.integer({ min: 0, max: 7 }), (value, index) => {
      const i = goldenInput("A", "pass");
      i.facts[index].value = value;
      const initial = screen(i).immutableHash;
      const mutations = [
        (v: EngineInput) => v.facts[index].value = value + 1,
        (v: EngineInput) => v.facts[index].inputState = "derived",
        (v: EngineInput) => v.facts[index].confidenceTier = "Calculated",
        (v: EngineInput) => v.facts[index].sourceId += "-changed",
      ];
      for (const mutate of mutations) {
        const v = structuredClone(i); mutate(v);
        expect(screen(v).immutableHash).not.toBe(initial);
      }
    }), { numRuns: 150 });
  });
  it("valid generated payloads always verify, even after JSON storage roundtrip", () => {
    fc.assert(fc.property(
      values, fc.integer({ min: 1, max: 100000 }), fc.constantFrom("A", "B"),
      fc.constantFrom("pass", "review", "fail", "insufficient"), seeds,
      (value, assets, example, outcome, seed) => {
        const i = goldenInput(example, outcome);
        i.facts[0].value = value;
        const denominator = i.facts.find((f) => f.lineItem === "total_assets");
        if (denominator) denominator.value = assets;
        const r = screen(i);
        expect(verify(reorderKeys(r.hashPayload, seed), r.immutableHash)).toBe(true);
        expect(verify(JSON.parse(JSON.stringify(r.hashPayload)), r.immutableHash)).toBe(true);
      },
    ), { numRuns: 150 });
  });
});
