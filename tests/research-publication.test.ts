import { beforeEach, expect, it, vi } from "vitest";
import { assembleDraft } from "../src/ai/research/draft";
import { fixturePackets } from "./fixtures/research/packets";
import { handwrittenModel } from "./fixtures/research/outputs";

const fixtures = vi.hoisted(() => ({
  audit: vi.fn(), staleness: vi.fn(), loadPacket: vi.fn(), scope: vi.fn(), lockedDraft: vi.fn(),
  activeAnalyst: vi.fn(), flag: vi.fn(), validate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/db/app", () => ({ dbApp: {} }));
vi.mock("../src/lib/research/access", () => ({
  assertActiveAnalyst: fixtures.activeAnalyst, configuredSettings: fixtures.scope, researchWriteLock: "lock",
}));
vi.mock("../src/lib/research/store", () => ({
  lockedDraft: fixtures.lockedDraft, blockingCount: (issues: unknown[]) => issues.length,
}));
vi.mock("../src/lib/research/stale-store", () => ({
  latestResearchFlag: fixtures.flag, updateStalenessForDraft: fixtures.staleness,
}));
vi.mock("../src/lib/research/loader", () => ({
  loadResearchPacket: fixtures.loadPacket, StoredResearchPacketLoader: class {},
}));
vi.mock("../src/ai/research/validators", () => ({ validateResearchDraft: fixtures.validate }));
vi.mock("../src/lib/auth/audit", () => ({ audit: fixtures.audit }));
vi.mock("../src/lib/research/publication-policy", () => ({ PUBLIC_RESEARCH_COPY_APPROVED: true }));
import { recordPublication } from "../src/lib/research/publication";

const packet = fixturePackets[0];
const securityId = packet.security.id;
const actor = { id: "admin-fixture" } as Parameters<typeof recordPublication>[1];
const after = { id: "1", draft_id: "draft-fixture", kind: "published", triggers: [], withdrawal_reason: null };
beforeEach(() => {
  vi.resetAllMocks();
  fixtures.scope.mockResolvedValue({ row: { ai_research_publishing: true }, scope: { max_packet_age_days: 5, max_financial_age_days: 300 } });
  fixtures.lockedDraft.mockResolvedValue({ packet,
    draft: { state: "approved", security_id: securityId, analyst_text: assembleDraft(handwrittenModel(packet), packet), validation_results: [] },
  });
  fixtures.loadPacket.mockResolvedValue(packet);
  fixtures.validate.mockReturnValue([]);
});

it("rechecks freshness and writes before/after audit in the same transaction as publication", async () => {
  const execute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([after]);
  const tx = { execute, select: () => ({ from: () => ({ where: async () => [] }) }) } as unknown as Parameters<typeof recordPublication>[0];
  await recordPublication(tx, actor, "draft-fixture", "published", null);
  expect(fixtures.staleness).toHaveBeenCalledWith(tx, "draft-fixture", expect.any(Date));
  expect(fixtures.validate).toHaveBeenCalledWith(expect.any(Object), packet,
    expect.objectContaining({ stage: "publish", latest_packet: packet, context_line_resolved: true, disclosure_resolved: true }));
  expect(execute).toHaveBeenCalledTimes(4);
  expect(fixtures.audit).toHaveBeenCalledWith(tx, actor, expect.objectContaining({
    event_type: "research_publication", details: { before: null, after },
  }));
  expect(fixtures.audit.mock.invocationCallOrder[0]).toBeGreaterThan(execute.mock.invocationCallOrder[2]);
});

it("refuses before draft reads, staleness writes or audit when the gate is off", async () => {
  fixtures.scope.mockResolvedValue({ row: { ai_research_publishing: false } });
  const execute = vi.fn().mockResolvedValue([]);
  const tx = { execute } as unknown as Parameters<typeof recordPublication>[0];
  await expect(recordPublication(tx, actor, "draft-fixture", "published", null)).rejects.toThrow("gate is off");
  expect(fixtures.lockedDraft).not.toHaveBeenCalled();
  expect(fixtures.staleness).not.toHaveBeenCalled();
  expect(fixtures.audit).not.toHaveBeenCalled();
  expect(execute).toHaveBeenCalledTimes(1);
});
