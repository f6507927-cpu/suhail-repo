import { describe, expect, it } from "vitest";
import { hash } from "../src/engine/canonical";
import type { JsonValue } from "../src/engine/types";
import { buildResearchPacket, FINANCIAL_FIELDS, packetHash } from "../src/ai/research/packet";
import { compareResearchPackets } from "../src/ai/research/changes";
import { decimalCalculation } from "../src/ai/research/decimal";
import { fixtureInput, fixturePackets, FIXTURE_CLOCK } from "./fixtures/research/packets";
import { assertPacketPrivacy } from "../src/ai/research/privacy";
import hashes from "./fixtures/research/hashes.json";

const input = () => structuredClone(fixtureInput());
describe("D-189 deterministic research packets", () => {
  it("pins all ten synthetic packets to frozen hashes", () => {
    expect(Object.fromEntries(fixturePackets.map(p => [p.security.ticker, p.packet_hash]))).toEqual(hashes);
  });
  it("uses canonical engine hashing, excludes only the build clock, and never mutates rows", () => {
    const rows = input(), saved = structuredClone(rows);
    const p = buildResearchPacket(rows, FIXTURE_CLOCK);
    expect(rows).toEqual(saved);
    expect(p).toEqual(buildResearchPacket(rows, FIXTURE_CLOCK));
    expect(buildResearchPacket(rows, "2026-11-02T12:00:00Z").packet_hash).toBe(p.packet_hash);
    const { built_at, packet_hash, ...payload } = p;
    void built_at;
    expect(packet_hash).toBe(hash(payload as unknown as JsonValue));
  });
  it("normalizes row order and selects the latest stored production run independently per methodology", () => {
    const rows = input(), old = structuredClone(rows.runs[0]);
    old.run_at = "2026-10-01T12:00:00Z"; old.status = "fails_selected_methodology";
    const other = { ...structuredClone(old), methodology: "other", status: "requires_review" as const };
    rows.runs.push(old, other, { ...old, methodology: "demo", production_enabled: false });
    rows.periods.push({ ...structuredClone(rows.periods[1]), id: "FY2023", period_end: "2023-12-31" });
    const p = buildResearchPacket(rows, FIXTURE_CLOCK);
    rows.runs.reverse(); rows.periods.reverse(); rows.periods.forEach(p => p.facts.reverse());
    expect(buildResearchPacket(rows, FIXTURE_CLOCK)).toEqual(p);
    expect(p.periods.map(p => p.id)).toEqual(["FY2025", "FY2024"]);
    expect(p.screenings.map(r => [r.methodology, r.status])).toEqual([
      ["fixture-method", "passes_selected_methodology"], ["other", "requires_review"],
    ]);
    expect(p.items.find(i => i.id === "scr.fixture-method.engine_version")?.value).toBe("fixture-engine");
  });
  it("compares run instants correctly with optional fractional seconds and refuses same-time ambiguity", () => {
    const rows = input();
    rows.runs.push({ ...structuredClone(rows.runs[0]), run_at: "2026-10-31T12:00:00.123Z", status: "requires_review" });
    expect(buildResearchPacket(rows, FIXTURE_CLOCK).screenings[0].status).toBe("requires_review");
    rows.runs[1].run_at = "2026-10-31T12:00:00.000Z";
    expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("timestamp");
    rows.runs = [{ ...rows.runs[0], run_at: "2026-11-01T12:00:00.001Z" }];
    expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("Future");
  });
  it("has stable unique IDs, metadata, sections and explicit unavailable reasons", () => {
    const p = fixturePackets[3];
    expect(new Set(p.items.map(i => i.id)).size).toBe(p.items.length);
    for (const item of p.items) {
      expect(item.source.id).toBeTruthy(); expect(item.date).toMatch(/^\d{4}-\d\d-\d\d$/);
      expect(item.confidence_tier).toBeTruthy();
      expect(p.sections[item.kind]).toContain(item.id);
      if (item.value === null) expect(item.unavailable).toBeTruthy();
    }
    expect(p.items.find(i => i.id === "fin.total_revenue.FY2025")?.unavailable).toBeTruthy();
    expect(p.items.find(i => i.id === "scr.fixture-method.unknown.revenue")?.value).toBe("No usable annual revenue");
  });
  it("computes only closed-list figures with formulas and input lineage", () => {
    const p = fixturePackets[0], value = (id: string) => p.items.find(i => i.id === `drv.${id}`)?.value;
    expect(value("revenue_growth")).toBe(20);
    expect(value("net_margin")).toBe(10);
    expect(value("gross_margin")).toBe(25);
    expect(value("operating_margin")).toBe(15);
    expect(value("debt_to_equity")).toBe(0.5);
    expect(value("operating_cash_flow")).toBe(15000000);
    expect(value("investing_cash_flow")).toBe(-8000000);
    expect(value("financing_cash_flow")).toBe(-2000000);
    expect(p.items.filter(i => i.kind === "derived")).toHaveLength(8);
    for (const item of p.items.filter(i => i.kind === "derived")) {
      expect(item.derivation?.formula).toBeTruthy();
      expect(item.derivation?.inputs.every(id => p.items.some(i => i.id === id))).toBe(true);
      expect(item.derivation?.rounding).toBeTruthy();
    }
    expect(decimalCalculation(0.3, 0.1, "growth", 100)).toBe(200);
    expect(decimalCalculation(1, 3, "ratio", 1)).toBe(0.333333);
    expect(decimalCalculation(-1, 128, "ratio", 1)).toBe(-0.007813);
    expect(() => decimalCalculation(1, 0, "ratio", 1)).toThrow("Zero");
  });
  it.each(["zero", "missing", "currency"])("never guesses when an input is %s", variant => {
    const rows = input(), fact = rows.periods[0].facts.find(f => f.field === "total_equity")!;
    if (variant === "zero") fact.value = 0;
    if (variant === "missing") rows.periods[0].facts = rows.periods[0].facts.filter(f => f !== fact);
    if (variant === "currency") fact.unit = "EUR";
    const derived = buildResearchPacket(rows, FIXTURE_CLOCK).items.find(i => i.id === "drv.debt_to_equity");
    expect(derived?.value).toBeNull(); expect(derived?.unavailable).toBeTruthy();
  });
  it("propagates Estimated confidence and never invents cash flow from earnings", () => {
    const rows = input();
    rows.periods[0].facts.find(f => f.field === "net_income")!.confidence_tier = "Estimated";
    rows.periods[0].facts = rows.periods[0].facts.filter(f => f.field !== "operating_cash_flow");
    const p = buildResearchPacket(rows, FIXTURE_CLOCK);
    expect(p.items.find(i => i.id === "drv.net_margin")?.confidence_tier).toBe("Estimated");
    expect(p.items.find(i => i.id === "drv.operating_cash_flow")?.value).toBeNull();
  });
  it("represents missing annual periods, prices and production runs explicitly", () => {
    const rows = input(); rows.periods = []; rows.prices = []; rows.runs = [];
    const p = buildResearchPacket(rows, FIXTURE_CLOCK);
    for (const id of ["fin.annual", "fin.prior_annual", "px.close", "scr.status"])
      expect(p.items.find(i => i.id === id)?.unavailable).toBeTruthy();
    expect(p.items.filter(i => i.kind === "derived").every(i => i.value === null)).toBe(true);
  });
  it.each(["identity", "fact", "run", "price"])("refuses synthetic or production-blocked %s sources", kind => {
    for (const flag of ["is_synthetic", "production_blocked"] as const) {
      const rows = input();
      const evidence = kind === "identity" ? rows.security : kind === "fact" ? rows.periods[0].facts[0]
        : kind === "run" ? rows.runs[0] : rows.prices[0];
      evidence.source = { ...evidence.source, [flag]: true };
      expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("Ineligible");
    }
  });
  it("whitelists data and blocks personal text without passing user/analyst/audit fields", () => {
    const rows = { ...input(), user: { email: "private@example.invalid" }, analyst: { id: "private-person" },
      audit_event: { actor_id: "private-actor" } };
    const p = buildResearchPacket(rows, FIXTURE_CLOCK);
    expect(JSON.stringify(p)).not.toMatch(/private|actor_id|audit_event|coverage_analyst_id/);
    rows.security.name = "private@example.invalid";
    expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("Personal");
    rows.security.name = "Call +1 202 555 0199";
    expect(() => buildResearchPacket(rows, FIXTURE_CLOCK)).toThrow("Personal");
    expect(() => assertPacketPrivacy({ actor_id: "secret" })).toThrow("Personal");
  });
  it.each(["clock", "future", "nan", "duplicate", "date", "filing"])("refuses invalid or ambiguous evidence: %s", variant => {
    const rows = input();
    if (variant === "future") rows.prices[0].date = "2027-01-01";
    if (variant === "nan") rows.periods[0].facts[0].value = NaN;
    if (variant === "duplicate") rows.periods[0].facts.push(rows.periods[0].facts[0]);
    if (variant === "date") rows.prices[0].date = "2026-02-31";
    if (variant === "filing") rows.periods[0].reported_date = "2027-01-01";
    expect(() => buildResearchPacket(rows, variant === "clock" ? "invalid" : FIXTURE_CLOCK)).toThrow();
  });
  it("changes the hash on effective data changes, not caller property order", () => {
    const rows = input(), p = buildResearchPacket(rows, FIXTURE_CLOCK);
    rows.prices[0].close++;
    expect(buildResearchPacket(rows, FIXTURE_CLOCK).packet_hash).not.toBe(p.packet_hash);
    expect(packetHash(p)).toBe(p.packet_hash);
    expect(FINANCIAL_FIELDS).toContain("total_revenue");
  });
});
describe("D-211 changes[]", () => {
  it("returns nothing for unchanged packets, including clock-only rebuilds", () => {
    expect(compareResearchPackets(fixturePackets[0], buildResearchPacket(input(), "2026-11-02T12:00:00Z"))).toEqual([]);
  });
  it("reports price moves, status changes, additions and removals with old and new values", () => {
    const rows = input(); rows.prices[0].close = 30;
    rows.runs[0].status = "requires_review";
    rows.runs[0].unknowns.push({ id: "changed", explanation: "New missing input" });
    const next = buildResearchPacket(rows, FIXTURE_CLOCK);
    next.items = next.items.filter(i => i.id !== "id.sic");
    const changes = compareResearchPackets(fixturePackets[0], next);
    expect(changes).toContainEqual(expect.objectContaining({ item_id: "px.close.2026-10", type: "changed", trigger: "price_move",
      old_value: expect.objectContaining({ value: 24.5 }), new_value: expect.objectContaining({ value: 30 }) }));
    expect(changes).toContainEqual(expect.objectContaining({ item_id: "scr.fixture-method.status", trigger: "status_change" }));
    expect(changes).toContainEqual(expect.objectContaining({ item_id: "scr.fixture-method.unknown.changed", type: "added", old_value: null }));
    expect(changes).toContainEqual(expect.objectContaining({ item_id: "id.sic", type: "removed", new_value: null }));
  });
  it("reports new filing changes and age crossings using only supplied settings", () => {
    const rows = input(); rows.periods[0].facts[0].value = 130000000;
    const next = buildResearchPacket(rows, "2026-11-03T12:00:00Z");
    const changes = compareResearchPackets(fixturePackets[0], next, {
      price_move_percent: 5, max_age_days: 90, reference_date: "2026-08-04T12:00:00Z",
    });
    expect(changes).toContainEqual(expect.objectContaining({ item_id: "fin.total_revenue.FY2025", trigger: "new_filing" }));
    expect(changes).toContainEqual({ item_id: "packet.age", type: "changed", old_value: false, new_value: true, trigger: "age" });
    expect(() => compareResearchPackets(fixturePackets[0], fixturePackets[1])).toThrow("different securities");
  });
  it("honours an explicit price-move threshold without hiding unrelated changes", () => {
    const rows = input(); rows.prices[0].close = 24.6; rows.security.activity = "changed";
    const changes = compareResearchPackets(fixturePackets[0], buildResearchPacket(rows, FIXTURE_CLOCK), {
      price_move_percent: 5, max_age_days: 90, reference_date: FIXTURE_CLOCK,
    });
    expect(changes.map(c => c.item_id)).toEqual(["id.activity"]);
  });
  it("includes changed structured reasons even when the overall status is unchanged", () => {
    const rows = input();
    rows.runs[0].reasons = [{ kind: "counts", criterionId: null, field: null, label: "", ratio: null,
      threshold: null, thresholdUnit: null, reasonCode: "criterion_counts", unknownCount: 1, borderlineCount: 0 }];
    const before = buildResearchPacket(rows, FIXTURE_CLOCK);
    rows.runs[0].reasons[0].unknownCount = 2;
    const after = buildResearchPacket(rows, FIXTURE_CLOCK);
    expect(compareResearchPackets(before, after)).toContainEqual(expect.objectContaining({
      item_id: expect.stringContaining("scr.fixture-method.reason."), type: "changed", trigger: "status_change",
    }));
  });
});
