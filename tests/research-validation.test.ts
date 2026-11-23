import { describe, expect, it } from "vitest";
import { assembleDraft, modelDraftSchema, renderFigures, screeningContext } from "../src/ai/research/draft";
import { BANNED_AR, BANNED_EN, containsPhrase, normalizeArabic, ARABIC_LIST_STATUS } from "../src/ai/research/banned-phrases";
import { extractClaims, renderedClaims, withinTolerance } from "../src/ai/research/grounding";
import { validateGuidance, validateResearchDraft, validationReport, type ValidationSettings } from "../src/ai/research/validators";
import { buildResearchPacket } from "../src/ai/research/packet";
import { fixtureInput, fixturePackets, FIXTURE_CLOCK } from "./fixtures/research/packets";
import { handwrittenModel, NEGATIVE_CASES, recordedOutput } from "./fixtures/research/outputs";
import { renderEnglish } from "../src/engine/reasons/en";
import { renderArabicDraft } from "../src/engine/reasons/ar";
import { groundingRegressionFixtures } from "./fixtures/research/grounding-regressions";

const settings: ValidationSettings = { now: FIXTURE_CLOCK, max_packet_age_days: 30,
  max_financial_age_days: 550, known_issuers: fixturePackets.map(p => p.security.name) };
const packet = fixturePackets[0];
const draft = () => assembleDraft(handwrittenModel(packet), packet);
const checks = (value: unknown, config = settings) => validateResearchDraft(value, packet, config).map(i => i.check);
describe("D-183 code-owned draft fields and rendering", () => {
  it("strictly requires both languages and exactly three plain-summary lines", () => {
    const model = handwrittenModel(packet);
    expect(modelDraftSchema.safeParse(model).success).toBe(true);
    expect(modelDraftSchema.safeParse({ ...model, shariah_context: [] }).success).toBe(false);
    expect(modelDraftSchema.safeParse({ ...model, citations: [] }).success).toBe(false);
    expect(modelDraftSchema.safeParse({ ...model, status: "pass" }).success).toBe(false);
    expect(modelDraftSchema.safeParse({ ...model, plain_summary: [model.plain_summary[0]] }).success).toBe(false);
    expect(modelDraftSchema.safeParse({ ...model, summary: { en: "Missing Arabic" } }).success).toBe(false);
  });
  it("uses the existing D-42 bilingual templates, without recomputing the engine", () => {
    const input = structuredClone(fixtureInput());
    input.runs[0].reasons = [{ kind: "counts", criterionId: null, label: "", field: null, ratio: null,
      threshold: null, thresholdUnit: null, reasonCode: "criterion_counts", unknownCount: 1, borderlineCount: 0 }];
    const p = buildResearchPacket(input, FIXTURE_CLOCK), reason = input.runs[0].reasons[0];
    expect(screeningContext(p)[0].reasons[0]).toEqual({ ar: renderArabicDraft(reason), en: renderEnglish(reason) });
    expect(screeningContext(p)[0].status).toBe(input.runs[0].status);
    const d = draft(); d.shariah_context[0].version = "fabricated";
    expect(checks(d)).toContain("status");
  });
  it("renders Western digits with bidi isolation, preserves percent units and refuses missing tokens", () => {
    for (const locale of ["ar", "en"] as const) {
      const rendered = renderFigures("{{fig:px.close.2026-10}}", packet, locale);
      expect(rendered).toContain("\u206624.5\u2069");
      expect(rendered).not.toMatch(/[٠-٩۰-۹]/);
      expect(renderFigures("{{fig:scr.fixture-method.debt.threshold}}", packet, locale)).toContain("33%");
      expect(() => renderFigures("{{fig:unknown}}", packet, locale)).toThrow("Unavailable");
      expect(() => renderFigures("{{fig:fin.net_income.FY2024}}", packet, locale)).toThrow("Unavailable");
      expect(() => renderFigures("{{fig:id.name}}", packet, locale)).toThrow("Non-figure");
    }
  });
  it("resolves citations deterministically and rejects unknown citation IDs", () => {
    const d = draft();
    expect(d.citations).toContainEqual({ item_id: "px.close.2026-10", source_id: "fixture-primary", url: "https://filing.example.invalid/annual" });
    const model = handwrittenModel(packet); model.strengths[0].cites = ["not-in-packet"];
    expect(() => assembleDraft(model, packet)).toThrow("Unknown citation");
  });
});
describe("D-190 validators and fixture evaluation", () => {
  it("accepts ten complete, hand-written synthetic drafts", () => {
    expect(fixturePackets).toHaveLength(10);
    for (const p of fixturePackets) {
      expect(p.security.name).toMatch(/^Synthetic /);
      expect(validateResearchDraft(assembleDraft(handwrittenModel(p), p), p, settings)).toEqual([]);
    }
  });
  it.each(NEGATIVE_CASES.map((c, i) => [c.id, c.check, i] as const))("blocks the deliberately bad %s fixture", (_id, check, i) => {
    const p = fixturePackets[i], d = recordedOutput(p, "deliberately-bad-v0", i);
    expect(validateResearchDraft(d, p, settings).map(i => i.check)).toContain(check);
  });
  it("runs grounding and language parity on plain_summary, including analyst-entered digits", () => {
    const d = draft();
    d.plain_summary[0].ar += " القيمة 987654321.";
    expect(checks(d)).toContain("grounding");
    expect(checks(d)).toContain("languages");
  });
  it("grounds typed Arabic-Indic and magnitude figures against cited amounts", () => {
    const model = handwrittenModel(packet);
    model.financial_highlights[0] = {
      text: { ar: "الإيرادات ١٢٠ مليون.", en: "Revenue was 120 million." }, cites: ["fin.total_revenue.FY2025"],
    };
    expect(checks(assembleDraft(model, packet))).toEqual([]);
    model.financial_highlights[0].cites = ["px.close.2026-10"];
    expect(checks(assembleDraft(model, packet))).toContain("grounding");
  });
  it("grounds dates exactly, in Gregorian Arabic/English order, never as separate digits", () => {
    const model = handwrittenModel(packet);
    model.financial_highlights[0] = { text: { ar: "التاريخ ٣١ ديسمبر ٢٠٢٥.", en: "The date is December 31, 2025." },
      cites: ["fin.total_revenue.FY2025"] };
    expect(checks(assembleDraft(model, packet))).toEqual([]);
    model.financial_highlights[0].text = { ar: "التاريخ ٣٠ ديسمبر ٢٠٢٥.", en: "The date is December 30, 2025." };
    expect(checks(assembleDraft(model, packet))).toContain("grounding");
    expect(extractClaims("2025-12-31")).toEqual([{ raw: "2025-12-31", value: "2025-12-31", kind: "date" }]);
    expect(extractClaims("12/31/2025")[0].value).toBe("ambiguous:12/31/2025");
    expect(extractClaims("31.12.2025")[0].kind).toBe("date");
    expect(extractClaims("Dec 31, 2025")[0].value).toBe("2025-12-31");
  });
  it("blocks unknown citations, forged resolved citations and uncited later sentences", () => {
    const d = draft(); d.financial_highlights[0].cites.push("missing");
    expect(checks(d)).toContain("citations");
    const second = draft(); second.citations[0].url = "https://forged.invalid/";
    expect(checks(second)).toContain("citations");
    const third = draft();
    third.summary = {
      ar: "القيمة {{fig:px.close.2026-10}}. والقيمة الأخرى 24.5.",
      en: "The value is {{fig:px.close.2026-10}}. The other value is 24.5.",
    };
    expect(checks(third)).toContain("citations");
  });
  it("rejects unequal tokens even when their values happen to match", () => {
    const d = draft();
    d.financial_highlights[0].text.ar = "القيمة {{fig:fin.net_income.FY2025}}.";
    expect(checks(d)).toContain("languages");
  });
  it("rejects English text in an Arabic field, missing fields and context tampering", () => {
    const d = draft(); d.summary.ar = "This is only English.";
    expect(checks(d)).toContain("languages");
    expect(checks(null)).toContain("schema");
    const forged = draft(); forged.shariah_context[0].status = "fails_selected_methodology";
    expect(checks(forged)).toContain("status");
  });
  it("checks approved status labels and raw enums against each named methodology", () => {
    for (const text of [
      { ar: "النتيجة غير متوافق على الأرجح.", en: "The result is Likely Non-Compliant." },
      { ar: "الحالة requires_review.", en: "The state is requires_review." },
    ]) {
      const d = draft(); d.summary = text;
      expect(checks(d)).toContain("status");
    }
    const d = draft(); d.summary = { ar: "النتيجة متوافق على الأرجح.", en: "The result is Likely Compliant." };
    expect(checks(d)).not.toContain("status");
  });
  it("distinguishes Arabic non-pass labels and separate methodologies in separate sentences", () => {
    const p = structuredClone(fixturePackets[1]);
    const d = assembleDraft(handwrittenModel(p), p);
    d.summary = { ar: "النتيجة غير متوافق على الأرجح.", en: "The result is Likely Non-Compliant." };
    expect(validateResearchDraft(d, p, settings).filter(i => i.check === "status")).toEqual([]);
    const rows = structuredClone(fixtureInput());
    rows.runs.push({ ...structuredClone(rows.runs[0]), methodology: "second-method", methodology_label: "Second methodology",
      status: "requires_review" });
    const two = buildResearchPacket(rows, FIXTURE_CLOCK), model = handwrittenModel(two);
    model.summary = {
      ar: "Synthetic methodology: متوافق على الأرجح. Second methodology: يحتاج إلى مراجعة.",
      en: "Synthetic methodology: Likely Compliant. Second methodology: Requires Review.",
    };
    expect(validateResearchDraft(assembleDraft(model, two), two, settings).filter(i => i.check === "status")).toEqual([]);
  });
  it("blocks other known issuers, but not this issuer's own name", () => {
    const d = draft(); d.summary.en = "Synthetic Beta has similar evidence.";
    expect(checks(d)).toContain("other_issuer");
    d.summary.en = "Synthetic Alpha has synthetic evidence.";
    expect(checks(d)).not.toContain("other_issuer");
  });
  it("blocks missing coverage, stale clocks and newer stored filing/run/price evidence", () => {
    const p = structuredClone(packet); p.security.covered = false; p.security.in_universe = false;
    expect(validateResearchDraft(draft(), p, settings).map(i => i.check)).toContain("coverage");
    expect(checks(draft(), { ...settings, now: "2027-11-01T12:00:00Z" })).toContain("freshness");
    for (const kind of ["filing", "run", "price"]) {
      const latest = structuredClone(packet);
      if (kind === "filing") latest.periods[0].period_end = "2026-12-31";
      if (kind === "run") latest.screenings[0].immutable_hash = "new-run";
      if (kind === "price") latest.items.find(i => i.kind === "price")!.date = "2026-11-30";
      expect(checks(draft(), { ...settings, latest_packet: latest })).toContain("freshness");
    }
    expect(() => checks(draft(), { ...settings, max_packet_age_days: NaN })).toThrow("settings");
  });
  it("requires all explicit limitations including stale flags, and rejects invented ones", () => {
    const d = draft(); d.data_limitations = [];
    expect(checks(d)).toContain("data_limitations");
    const second = draft(); second.data_limitations[0].covers.push("invented");
    expect(checks(second)).toContain("data_limitations");
    const report = validateResearchDraft(draft(), packet, { ...settings, now: "2027-11-01T12:00:00Z" });
    expect(report).toContainEqual(expect.objectContaining({ check: "data_limitations", message: expect.stringContaining("stale:packet") }));
  });
  it("detects packet tampering and resolves publish disclosures without creating legal copy", () => {
    const p = structuredClone(packet); p.items[0].value = 999;
    expect(validateResearchDraft(draft(), p, settings).map(i => i.check)).toContain("packet_integrity");
    expect(checks(draft(), { ...settings, stage: "publish" })).toContain("disclosure");
    expect(checks(draft(), { ...settings, stage: "publish", disclosure_resolved: true, context_line_resolved: true })).not.toContain("disclosure");
    const report = validationReport(draft(), packet, settings);
    expect(report).toMatchObject({ validator_version: "research-validator-1", banned_phrases_version: "research-banned-1",
      style_guide_version: "research-style-2", banned_ar_version: "research-banned-ar-1", issues: [] });
  });
});
describe("grounding, Arabic normalization and safety edges", () => {
  it.each(groundingRegressionFixtures())("pins bilingual evidence-scoping regression: $id", fixture => {
    const issues = validateResearchDraft(fixture.draft, fixture.packet, settings);
    if (fixture.expected) {
      for (const locale of ["ar", "en"])
        expect(issues).toContainEqual(expect.objectContaining({ check: fixture.expected,
          location: `financial_highlights.0.${locale}` }));
    } else expect(issues).toEqual([]);
  });
  it("does not infer a calendar role from four digits, and retains the figure's item/type", () => {
    expect(extractClaims("Revenue was 2025.")[0].kind).toBe("number");
    expect(extractClaims("بلغت الإيرادات ٢٠٢٥.")[0].kind).toBe("number");
    expect(extractClaims("In 2025.")[0].kind).toBe("year");
    const fixture = groundingRegressionFixtures().find(f => f.id === "numeric-token-2049")!;
    expect(renderedClaims("{{fig:px.close.2026-10}}", fixture.packet, "ar").claims).toEqual([
      { raw: "2,049", value: 2049, kind: "number", item_id: "px.close.2026-10" },
    ]);
    expect(renderedClaims("In {{fig:px.close.2026-10}}", fixture.packet, "en").claims[0].kind).toBe("number");
  });
  it("parses complete rendered modifiers without losing token provenance or currency", () => {
    expect(renderedClaims("{{fig:px.close.2026-10}} million", packet, "en").claims[0]).toMatchObject({
      value: 24500000, kind: "number", item_id: "px.close.2026-10", magnitude: 1000000, token_modified: true,
    });
    expect(renderedClaims("{{fig:px.close.2026-10}}%", packet, "en").claims[0]).toMatchObject({
      value: 24.5, kind: "percent", item_id: "px.close.2026-10", token_modified: true,
    });
    expect(extractClaims("$33")[0]).toMatchObject({ value: 33, kind: "number", currency: "USD" });
    expect(extractClaims("EUR 24.5")[0]).toMatchObject({ currency: "EUR" });
    expect(extractClaims("JPY 24.5")[0]).toMatchObject({ currency: "JPY" });
    expect(extractClaims("¥24.5")[0]).toMatchObject({ currency: "ambiguous:¥" });
    expect(extractClaims("33% dollars")[0]).toMatchObject({ kind: "percent", currency: "USD" });
    expect(extractClaims("$\u061c33%")[0]).toMatchObject({ kind: "percent", currency: "USD" });
  });
  it("requires bilingual figures to agree in currency, not only numeric digits", () => {
    const rows = structuredClone(fixtureInput());
    const income = rows.periods[0].facts.find(f => f.field === "net_income")!;
    income.value = 24.5; income.unit = "EUR";
    const p = buildResearchPacket(rows, FIXTURE_CLOCK), model = handwrittenModel(p);
    model.financial_highlights[0] = { text: {
      ar: "المبلغ €24.5 {{cite:fin.net_income.FY2025}}.",
      en: "The amount is $24.5 {{cite:px.close.2026-10}}.",
    }, cites: [] };
    const issues = validateResearchDraft(assembleDraft(model, p), p, settings);
    expect(issues.map(i => i.check)).toContain("languages");
    expect(issues.map(i => i.check)).not.toContain("grounding");
  });
  it("rejects token modifiers even at zero, doubled percent signs and merged numeric tokens", () => {
    const p = fixturePackets[8], model = handwrittenModel(p);
    model.financial_highlights[0] = { text: {
      ar: "القيمة {{fig:fin.net_income.FY2025}} مليون.",
      en: "The value is {{fig:fin.net_income.FY2025}} million.",
    }, cites: [] };
    expect(validateResearchDraft(assembleDraft(model, p), p, settings).map(i => i.check)).toContain("grounding");
    for (const text of [
      { ar: "القيمة {{fig:scr.fixture-method.debt.threshold}}%.", en: "The value is {{fig:scr.fixture-method.debt.threshold}}%." },
      { ar: "القيمة {{fig:px.close.2026-10}}{{fig:fin.total_revenue.FY2025}}.", en: "The value is {{fig:px.close.2026-10}}{{fig:fin.total_revenue.FY2025}}." },
    ]) {
      const model = handwrittenModel(packet); model.financial_highlights[0] = { text, cites: [] };
      expect(checks(assembleDraft(model, packet))).toContain("grounding");
    }
  });
  it.each([
    ["١٬٢٠٠٫٥٪", 1200.5, "percent"], ["۱۲۰ میلیون", 120, "number"],
    ["$1.5 billion", 1500000000, "number"], ["١٫٥ مليار", 1500000000, "number"],
    ["2M", 2000000, "number"], ["-٢ مليون", -2000000, "number"],
  ])("parses %s", (text, value, kind) => expect(extractClaims(text)[0]).toMatchObject({ value, kind }));
  it("applies exact, absolute, decimal-rounded and strict relative tolerances", () => {
    expect(withinTolerance(100, 100)).toBe(true);
    expect(withinTolerance(0.0049, 0)).toBe(true);
    expect(withinTolerance(0.005, 0)).toBe(false);
    expect(withinTolerance(1.3, 1.25)).toBe(true);
    expect(withinTolerance(-1.3, -1.25)).toBe(true);
    expect(withinTolerance(100.4999, 100)).toBe(true);
    expect(withinTolerance(100.5, 100)).toBe(false);
    expect(withinTolerance(Infinity, 100)).toBe(false);
  });
  it("normalizes Arabic diacritics, tatweel, alef and ya without substring overmatching", () => {
    expect(normalizeArabic("إِيـمَان عَلَى")).toBe("ايمان علي");
    expect(containsPhrase("مَضْـمُون", "مضمون")).toBe(true);
    expect(containsPhrase("This is GUARANTEED!", "guaranteed")).toBe(true);
    expect(containsPhrase("buyer seller buyingpower", "buy")).toBe(false);
    expect(ARABIC_LIST_STATUS).toBe("Founder-approved, provisional (D-222)");
  });
  it("pins the 25 Arabic phrases provisionally approved in D-222", () => {
    expect(BANNED_AR.map(entry => entry.phrase)).toEqual([
      "اشتر", "اشتري", "شراء", "بع", "بيع", "توصية", "أوصي", "السعر المستهدف", "القيمة العادلة",
      "سيرتفع حتماً", "سينخفض حتماً", "مضمون", "مضمونة", "بلا مخاطر", "بدون مخاطر",
      "حلال", "حرام", "فتوى", "معتمد شرعياً", "متوافق شرعياً", "أقره العلماء",
      "يجب عليك", "محفظتك", "خصص من", "حجم المركز",
    ]);
    expect(BANNED_AR.every(entry => entry.severity === "block")).toBe(true);
  });
  it.each([...BANNED_EN, ...BANNED_AR])("blocks the minimum banned/advice phrase: $phrase", entry => {
    const d = draft();
    const locale = /[a-z]/i.test(entry.phrase) ? "en" : "ar";
    d.summary[locale] = locale === "en" ? `Synthetic text: ${entry.phrase}.` : `نص اصطناعي: ${entry.phrase}.`;
    expect(checks(d)).toContain("banned_phrase");
  });
  it.each(["contact@example.invalid", "+1 (202) 555-0199", "٠٥٥ ١٢٣ ٤٥٦٧", "x".repeat(2001)])("blocks personal or oversized analyst guidance", text => {
    expect(validateGuidance(text)[0]?.severity).toBe("block");
    expect(checks(draft(), { ...settings, guidance: text })).toContain("personal_data");
  });
  it("allows short non-personal guidance", () => expect(validateGuidance("Explain the uncertainty plainly.")).toEqual([]));
  it.each([
    "Evidence dated 2025-10-31.",
    "Revenue 1200000000; shares 12345678901234567890.",
    "2025 1200000000",
    "Revenue $120,000,000.00; margin 0.00%.",
    "Revenue 120 000 000 and assets 120-000-000-000.",
    "التاريخ ٢٠٢٥-١٠-٣١ والإيرادات ١٢٠٠٠٠٠٠٠٠.",
  ])("does not flag dates or figures in guidance or packet text: %s", text => {
    expect(validateGuidance(text)).toEqual([]);
    const rows = fixtureInput(); rows.security.activity = text;
    expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).not.toThrow();
  });
  it.each(["+1 (202) 555-0199", "+966551234567.", "٠٥٥ ١٢٣ ٤٥٦٧", "Phone: 2025550199", "06 12 34 56 78"])(
    "still refuses a real phone shape in guidance and packet text: %s", text => {
      expect(validateGuidance(text)).toContainEqual(expect.objectContaining({ check: "personal_data" }));
      const rows = fixtureInput(); rows.security.activity = text;
      expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("Personal contact");
    });
});
