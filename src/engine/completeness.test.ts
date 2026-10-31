import { describe, expect, it } from "vitest";
import { criterion, goldenInput } from "./__fixtures__/synthetic";
import { evidenceCases, evidenceGoldenInput } from "./__fixtures__/evidence";
import { canonicalize, screen, verify, type Criterion, type EngineInput, type JsonObject, type JsonValue } from "./index";

describe("D-89: all output-affecting inputs are hashed", () => {
  it.each([
    ["asOf", (i: EngineInput) => i.asOf = "2026-10-12"],
    ["stalenessLimitDays", (i: EngineInput) => i.stalenessLimitDays = 551],
    ["periodEnd", (i: EngineInput) => i.period.periodEnd = "2025-12-30"],
    ["period label", (i: EngineInput) => i.period.label += " corrected"],
    ["methodology label", (i: EngineInput) => i.methodologyVersion.label += " corrected"],
    ["segment tier", (i: EngineInput) => i.segments[0].confidenceTier = "Calculated"],
    ["criterion label", (i: EngineInput) => i.methodologyVersion.criteria[2].label += " corrected"],
    ["numerator definition", (i: EngineInput) => i.methodologyVersion.criteria[2].numeratorDefinition += " corrected"],
    ["denominator definition", (i: EngineInput) => i.methodologyVersion.criteria[2].denominatorDefinition += " corrected"],
    ["source reference", (i: EngineInput) => i.methodologyVersion.criteria[2].sourceReference += " corrected"],
    ["sort order", (i: EngineInput) => i.methodologyVersion.criteria[2].sortOrder = 99],
    ["security ID", (i: EngineInput) => i.securityId += "-corrected"],
    ["period ID", (i: EngineInput) => i.period.id += "-corrected"],
    ["methodology ID", (i: EngineInput) => i.methodologyVersion.id += "-corrected"],
  ])("%s changes the hash even with unchanged status/quality", (_, mutate) => {
    const i = goldenInput("A", "pass");
    const before = screen(i);
    (mutate as (i: EngineInput) => void)(i);
    const after = screen(i);
    expect(after.status).toBe(before.status);
    expect(after.dataAdequacy).toBe(before.dataAdequacy);
    expect(after.confidence).toBe(before.confidence);
    expect(after.immutableHash).not.toBe(before.immutableHash);
  });
  it("a non-weakest segment tier change still invalidates idempotency", () => {
    const i = goldenInput("A", "pass");
    i.segments[0].confidenceTier = "AI Interpretation";
    const before = screen(i);
    i.segments[1].confidenceTier = "Calculated";
    const after = screen(i);
    expect(after.criteria).toEqual(before.criteria);
    expect(after.immutableHash).not.toBe(before.immutableHash);
    expect((after.hashPayload.segments as JsonObject[])[0].confidence_tier).toBe("Calculated");
  });
  it("freshness unknowns cannot be hidden by fail/blocking precedence", () => {
    const i = goldenInput("A", "fail");
    i.methodologyVersion.criteria.push(criterion({ id: "unregistered", criterionType: "future" }));
    const before = screen(i);
    i.asOf = "2030-01-01";
    const after = screen(i);
    expect(before.status).toBe("fails_selected_methodology");
    expect(before.confidence).toBe("Low");
    expect(after.status).toBe(before.status);
    expect(after.dataAdequacy).toBe(before.dataAdequacy);
    expect(after.confidence).toBe(before.confidence);
    expect(after.criteria).toEqual(before.criteria);
    expect(after.statusReasons).toEqual(before.statusReasons);
    expect(after.unknowns.length).toBe(before.unknowns.length + 1);
    expect(after.immutableHash).not.toBe(before.immutableHash);
  });
  it("the implicit and explicit default staleness limit represent the same input", () => {
    const i = goldenInput("A", "pass");
    const implicit = screen(i);
    i.stalenessLimitDays = 550;
    expect(screen(i)).toEqual(implicit);
    expect(implicit.hashPayload.staleness_limit_days).toBe(550);
  });
  it("metadata not read by evaluators remains descriptive, not a hidden calculation rule", () => {
    const i = goldenInput("A", "pass");
    const before = screen(i);
    for (const c of i.methodologyVersion.criteria) {
      c.definition += " amended"; c.formulaText += " amended"; c.treatmentRules += " amended";
      c.edgeCases += " amended"; c.requiredInputs.push("unused_metadata");
      c.effectiveDate = "2026-02-01"; c.notes += " amended";
    }
    expect(screen(i)).toEqual(before); // D-87; no stored engine output reads these fields.
  });
  it("outputs include every criterion evidence field, each unknown and structured reason", () => {
    const i = evidenceGoldenInput("missing_numerator");
    i.asOf = "2030-01-01";
    const r = screen(i);
    const p = r.hashPayload.outputs as JsonObject;
    const fields = {
      criterionId: "criterion_id", criterionType: "criterion_type", label: "label",
      result: "result", numeratorValue: "numerator", denominatorValue: "denominator",
      numeratorDefinition: "numerator_definition", denominatorDefinition: "denominator_definition",
      ratio: "ratio", threshold: "threshold", thresholdUnit: "threshold_unit",
      thresholdDirection: "threshold_direction", borderlineMargin: "borderline_margin",
      inputStates: "input_states", confidenceTier: "confidence_tier", sourceIds: "source_ids",
      calculationTrace: "calculation_trace", resultReasonCode: "result_reason_code",
      sortOrder: "sort_order", sourceReference: "source_reference",
    };
    for (const [index, c] of r.criteria.entries()) {
      expect(Object.keys(fields).sort()).toEqual(Object.keys(c).sort());
      for (const [key, projection] of Object.entries(fields)) {
        expect((p.criteria as JsonObject[])[index][projection])
          .toEqual(canonicalize((c as unknown as JsonObject)[key]));
      }
    }
    const snake = (value: JsonObject) => canonicalize(Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), item])));
    expect(p.unknowns).toEqual(r.unknowns.map((u) => snake(u as unknown as JsonObject)));
    expect(p.status_reasons).toEqual(r.statusReasons.map((s) => snake(s as unknown as JsonObject)));
    expect(p.status).toBe(r.status);
    expect(p.data_adequacy).toBe(r.dataAdequacy);
    expect(p.confidence).toBe(r.confidence);
    const tampered = structuredClone(r.hashPayload);
    const outputs = tampered.outputs as JsonObject;
    (outputs.criteria as JsonObject[])[0].confidence_tier = "Estimated";
    expect(verify(tampered, r.immutableHash)).toBe(false);
  });
  it("the pre-D-89 EX-A payload still verifies against its original stored hash", () => {
    const i = goldenInput("A", "pass");
    const now = screen(i);
    const oldCriterion = (c: Criterion) => ({
      id: c.id, criterion_type: c.criterionType, threshold: c.threshold,
      threshold_unit: c.thresholdUnit, threshold_direction: c.thresholdDirection,
      borderline_margin: c.borderlineMargin, numerator_line_items: c.numeratorLineItems,
      denominator_line_items: c.denominatorLineItems, treatment_rule_data: c.treatmentRuleData,
    });
    const historic: JsonObject = {
      engine_version: "engine-1.0.0", calculation_version: i.calculationVersion,
      security_id: i.securityId, methodology_version_id: i.methodologyVersion.id,
      financial_period_id: i.period.id, facts: now.hashPayload.facts,
      segments: (now.hashPayload.segments as JsonObject[]).map((s) => {
        const old = { ...s }; delete old.confidence_tier; return old;
      }),
      criteria: i.methodologyVersion.criteria.map(oldCriterion),
      outputs: {
        status: now.status, data_adequacy: now.dataAdequacy, confidence: now.confidence,
        criteria: now.criteria.map((c) => ({
          result: c.result, numerator: c.numeratorValue, denominator: c.denominatorValue, ratio: c.ratio,
        })),
      },
    };
    expect(verify(historic, "8bc9209577fdf9adb66b03bf8e926b5fa9037d6723c49664095e43ca63938723")).toBe(true);
    expect(verify(now.hashPayload, "8bc9209577fdf9adb66b03bf8e926b5fa9037d6723c49664095e43ca63938723")).toBe(false);
  });
  it("sub-canonical numeric differences that change stored trace text cannot collide", () => {
    const i = goldenInput("A", "pass");
    const before = screen(i);
    i.facts[0].value = 12.000000000001;
    const after = screen(i);
    expect(canonicalize(i.facts[0].value)).toBe(12.000000000001);
    expect(canonicalize({ engine_version: "engine-1.0.1", value: i.facts[0].value })).toEqual({ engine_version: "engine-1.0.1", value: 12 });
    expect(after.criteria[2].ratio).toBe(before.criteria[2].ratio);
    expect(after.criteria[2].calculationTrace).not.toBe(before.criteria[2].calculationTrace);
    expect(after.immutableHash).not.toBe(before.immutableHash);
  });
});

describe("D-90: five additional EX-A golden evidence fixtures", () => {
  const expected = {
    prohibited_primary: ["fails_selected_methodology", "adequate", "High"],
    estimated_input: ["passes_selected_methodology", "adequate_with_estimates", "Medium"],
    stale_period: ["requires_review", "adequate_with_estimates", "Medium"],
    missing_numerator: ["requires_review", "adequate_with_estimates", "Low"],
    prohibited_primary_tie: ["requires_review", "adequate", "High"],
  };
  it.each(evidenceCases)("%s", (example) => {
    const i = evidenceGoldenInput(example);
    const r = screen(i);
    expect([r.status, r.dataAdequacy, r.confidence]).toEqual(expected[example]);
    expect(verify(r.hashPayload, r.immutableHash)).toBe(true);
    switch (example) {
      case "prohibited_primary":
        expect(r.criteria[0].result).toBe("fail");
        expect(r.criteria[0].resultReasonCode).toBe("primary_prohibited");
        break;
      case "estimated_input":
        expect(r.criteria.every((c) => c.result === "pass")).toBe(true);
        expect(r.criteria[3].inputStates).toContain("estimated");
        expect(r.criteria[3].confidenceTier).toBe("Estimated");
        break;
      case "stale_period":
        expect((Date.parse(`${i.asOf}T00:00:00Z`) - Date.parse(`${i.period.periodEnd}T00:00:00Z`)) / 86400000).toBe(551);
        expect(r.criteria.every((c) => c.result === "pass")).toBe(true);
        expect(r.unknowns[0]).toMatchObject({ field: "Data freshness", severity: "review" });
        break;
      case "missing_numerator":
        expect(r.criteria[3]).toMatchObject({ result: "unknown", numeratorValue: null });
        expect(r.criteria[3].inputStates).toContain("missing"); // D-88
        break;
      case "prohibited_primary_tie":
        expect(r.criteria[0].result).toBe("unknown");
        expect(r.criteria.slice(1).every((c) => c.result === "pass")).toBe(true);
        expect(r.unknowns[0]).toMatchObject({
          severity: "review", explanation: "primary activity tied between segments",
        });
        break;
    }
    // The full canonical payload commits input/output evidence, not only status.
    expect({
      company: i.period.label.replace(" annual", ""), methodology: "EX-A",
      hashPayload: r.hashPayload, immutableHash: r.immutableHash, financialSnapshotId: r.financialSnapshotId,
    } as JsonValue).toMatchSnapshot();
  });
});
