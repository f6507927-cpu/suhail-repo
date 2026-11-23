import { describe, expect, it, vi } from "vitest";
import { detectStaleness, exceedsPriceMove, packetClose } from "../src/ai/research/staleness";
import { compareResearchPackets } from "../src/ai/research/changes";
import { buildResearchPacket } from "../src/ai/research/packet";
import { assembleDraft } from "../src/ai/research/draft";
import { fixtureInput, fixturePackets, FIXTURE_CLOCK, source } from "./fixtures/research/packets";
import { handwrittenModel } from "./fixtures/research/outputs";
import { buildPrompt } from "../src/lib/research/prompt";
import { generateResearch } from "../src/lib/research/generate";
import { RecordedResearchClient } from "../src/lib/research/recorded-client";

const packet = fixturePackets[0];
const same = { filings: packet.periods, runs: packet.screenings, close: packetClose(packet) };
const policy = { price_move_threshold_percent: 10, publication_age_days: 90 };
const approved = new Date("2026-11-02T12:00:00Z");
describe("P3 pure staleness", () => {
  it("does not flag unchanged evidence or threshold equality", () => {
    const exact = new Date(+approved + 90 * 86400000);
    expect(detectStaleness(packet, same, policy, approved, exact)).toEqual([]);
    expect(exceedsPriceMove(100, 110, 10)).toBe(false);
    expect(exceedsPriceMove(100, 109.99999999, 10)).toBe(false);
    expect(exceedsPriceMove(100, 110.00000001, 10)).toBe(true);
    expect(exceedsPriceMove(100, 89.99999999, 10)).toBe(true);
    expect(exceedsPriceMove(0, 100, 10)).toBe(false);
  });
  it("flags a newer period or a late filing independently, and clears once the new dates are in the packet", () => {
    for (const filing of [{ period_end: "2026-03-31", reported_date: "2026-01-15" },
      { period_end: "2025-12-31", reported_date: "2026-10-01" }]) {
      const latest = { ...same, filings: [...same.filings, filing] };
      expect(detectStaleness(packet, latest, policy, approved, approved)).toEqual(["new_filing"]);
      expect(detectStaleness({ ...packet, filings: [{ id: "new", ...filing }] }, latest, policy, approved, approved)).toEqual([]);
    }
  });
  it("flags a hash change, a status change with the same hash, or a missing methodology", () => {
    const run = same.runs[0];
    const alternatives = [[{ ...run, immutable_hash: "different" }], [{ ...run, status: "requires_review" as const }], []];
    for (const runs of alternatives)
      expect(detectStaleness(packet, { ...same, runs }, policy, approved, approved)).toEqual(["status_changed"]);
  });
  it("flags stored price movement and approval age, never guessing missing thresholds or currency", () => {
    const close = { ...same.close!, value: same.close!.value * 2 };
    const now = new Date(+approved + 90 * 86400000 + 1);
    expect(detectStaleness(packet, { ...same, close }, policy, approved, now)).toEqual(["price_moved", "aged"]);
    expect(detectStaleness(packet, { ...same, close: { ...close, currency: "SAR" } }, policy, approved, approved)).toEqual([]);
    expect(detectStaleness(packet, { ...same, close }, { price_move_threshold_percent: null, publication_age_days: null }, approved, now)).toEqual([]);
  });
});
describe("P3 refresh packet and recorded generation", () => {
  const rows = fixtureInput();
  const revised = buildResearchPacket({ ...rows, prices: [{ ...rows.prices[0], month_end_for: "2026-09", date: "2026-09-30" }],
    filings: [{ id: "quarter", source, date: "2026-10-01",
    period_end: "2026-09-30", reported_date: "2026-10-01", confidence_tier: "Verified" }],
  runs: rows.runs.map(run => ({ ...run, immutable_hash: "recomputed" })) }, FIXTURE_CLOCK);
  const changes = compareResearchPackets(packet, revised);
  it("records additions, removals and changed values with their trigger, without changing P1 baselines", () => {
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ item_id: "fin.filing.quarter", type: "added", trigger: "new_filing", old_value: null,
        new_value: expect.objectContaining({ value: "2026-10-01" }) }),
      expect.objectContaining({ item_id: "px.close.2026-10", type: "removed", trigger: "price_move", new_value: null,
        old_value: expect.objectContaining({ value: same.close!.value }) }),
      expect.objectContaining({ item_id: "scr.fixture-method.immutable_hash", type: "changed", trigger: "status_change",
        old_value: expect.objectContaining({ value: packet.screenings[0].immutable_hash }),
        new_value: expect.objectContaining({ value: "recomputed" }) }),
    ]));
  });
  it("wraps previous text and validates an entire recorded refresh, including a retained invalid passage", async () => {
    const previous = assembleDraft(handwrittenModel(packet), packet);
    previous.summary = { ...previous.summary, en: "You should buy this stock." };
    const request = { packet: revised, guidance: "", refresh: { previous, changes },
      max_input_tokens: 4000, max_output_tokens: 2000 };
    const prompt = buildPrompt(request);
    const structured = JSON.parse(prompt.user.split("\n")[1]);
    expect(prompt.system).toContain("Revise the previous approved prose only where changes require it.");
    expect(structured.previous.summary.en).toHaveProperty("untrusted_text");
    expect(structured.changes).toEqual(expect.arrayContaining([expect.objectContaining({ trigger: "new_filing" })]));
    const model = handwrittenModel(revised);
    model.summary = { ...model.summary, en: previous.summary.en };
    const budget = { reserve: vi.fn(async () => true), settle: vi.fn(async () => {}) };
    const result = await generateResearch(new RecordedResearchClient([{ text: JSON.stringify(model), model: "recorded", model_version: "fixture",
      stop_reason: "end_turn", input_tokens: 100, output_tokens: 50 }]), request, budget, {
      now: FIXTURE_CLOCK, max_packet_age_days: 30, max_financial_age_days: 550, known_issuers: [],
    });
    expect(result).toMatchObject({ state: "generated", attempts: 1 });
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ severity: "block", location: expect.stringContaining("summary") })]));
    expect(budget.settle).toHaveBeenCalledWith(6000, 150);
  });
});
