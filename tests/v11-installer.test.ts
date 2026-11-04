import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const services = vi.hoisted(() => ({
  saveCases: vi.fn(), saveVersion: vi.fn(), saveCriterion: vi.fn(),
  associateSource: vi.fn(), requireLaunchActor: vi.fn(),
}));
vi.mock("../src/lib/methodology/service", () => services);
vi.mock("../src/lib/launch/draft", () => services);
import { installV11 } from "../src/lib/methodology/install-v11";
import { criterionSchema } from "../src/lib/methodology/contracts";
import { proposedV11Definition } from "../src/lib/methodology/proposed-v1.1";
import { launchCases, launchDefinition } from "../src/lib/launch/contracts";
import base from "../data/methodologies/al-rajhi-adapted-1.0.json";
import type { Tx } from "../src/lib/auth/audit";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture(existing = true) {
  const definition = proposedV11Definition();
  const actor = { id: id(50), email: "fixture@example.invalid", role: "admin" };
  const parent = { id: id(51), ...definition.metadata, is_demo: false, production_blocked: false };
  const oldCriteria = base.criteria.map(({ key: _key, ...c }, i) => {
    void _key; return { ...criterionSchema.parse(c), id: id(i + 1) };
  });
  const cases = launchCases(launchDefinition(base),
    Object.fromEntries(base.criteria.map((c, i) => [c.key, oldCriteria[i].id])));
  const document = { id: id(52), source_type: "methodology_document", source_url: parent.source_url,
    confidence_tier: "Verified", is_demo: false, is_synthetic: false, production_blocked: false, document_title: "Fixture document" };
  const v10 = { id: id(53), version: "1.0", source_ids: [document.id], analyst_test_cases: cases };
  const v11 = { id: id(54), ...definition.version, is_demo: false, production_blocked: false,
    source_ids: [document.id], analyst_test_cases: [], workflow_status: "draft", production_enabled: false };
  const criteria = definition.criteria.map(({ key: _key, ...c }, i) => {
    void _key; return { ...criterionSchema.parse(c), id: id(i + 11) };
  });
  const queued: unknown[][] = [];
  const execute = vi.fn().mockResolvedValue([]);
  const tx = { execute, select: () => ({ from: () => {
    const rows = queued.shift();
    if (!rows) throw new Error("Unexpected fixture query");
    return Object.assign(Promise.resolve(rows), { where: () => Promise.resolve(rows) });
  } }) } as unknown as Tx;
  function enqueue() {
    queued.push([actor], [parent], existing ? [v10, v11] : [v10], [document], oldCriteria);
    if (existing) queued.push(criteria);
  }
  services.saveVersion.mockResolvedValue(v11.id);
  services.saveCriterion.mockImplementation(async (_tx, _actor, _v, _old, c) => criteria.find(r => r.sort_order === c.sort_order)!.id);
  return { tx, execute, enqueue, actor, v10, v11, criteria, cases };
}
beforeEach(() => vi.resetAllMocks());
describe("fixture-only v1.1 installer case backfill", () => {
  it("dry-run plans missing cases in read-only mode without calling any mutation service", async () => {
    const f = fixture(); f.enqueue();
    expect(await installV11(f.tx, f.actor.email, true)).toMatchObject({ action: "add missing cases", casesAdded: f.cases.length + 8 });
    expect(f.execute.mock.calls[0][0].queryChunks.map((c: { value?: unknown }) => c.value).flat().join("")).toContain("read only");
    for (const mock of Object.values(services)) expect(mock).not.toHaveBeenCalled();
  });
  it("backfills through the audited service, preserves existing cases, and reruns without writes", async () => {
    const f = fixture(); f.enqueue();
    await installV11(f.tx, f.actor.email, false);
    const saved = services.saveCases.mock.calls[0][3];
    expect(saved).toHaveLength(f.cases.length + 8);
    expect(services.saveCases).toHaveBeenCalledWith(f.tx, f.actor, f.v11.id, saved);
    Object.assign(f.v11, { analyst_test_cases: [saved[0]] });
    services.saveCases.mockClear(); f.enqueue();
    expect(await installV11(f.tx, f.actor.email, false)).toMatchObject({ casesAdded: saved.length - 1 });
    Object.assign(f.v11, { analyst_test_cases: saved });
    services.saveCases.mockClear(); f.enqueue();
    expect(await installV11(f.tx, f.actor.email, false)).toMatchObject({ action: "unchanged", casesAdded: 0 });
    expect(services.saveCases).not.toHaveBeenCalled();
    expect(f.v11.workflow_status).toBe("draft");
    expect(f.v11.production_enabled).toBe(false);
    expect(services.saveVersion).not.toHaveBeenCalled();
    expect(services.saveCriterion).not.toHaveBeenCalled();
    expect(services.associateSource).not.toHaveBeenCalled();
  });
  it("refuses missing cases after draft without mutation", async () => {
    const f = fixture(); f.v11.workflow_status = "source_verified"; f.enqueue();
    await expect(installV11(f.tx, f.actor.email, false)).rejects.toThrow("only be added while v1.1 is draft");
    expect(services.saveCases).not.toHaveBeenCalled();
  });
  it("includes copied and new cases on initial creation; dry-run creates nothing", async () => {
    const f = fixture(false); f.enqueue();
    expect(await installV11(f.tx, f.actor.email, true)).toMatchObject({ action: "create draft", casesAdded: f.cases.length + 8 });
    expect(services.saveVersion).not.toHaveBeenCalled();
    f.enqueue();
    expect(await installV11(f.tx, f.actor.email, false)).toMatchObject({ action: "created draft", casesAdded: f.cases.length + 8 });
    expect(services.saveCases).toHaveBeenCalledOnce();
    expect(services.associateSource).toHaveBeenCalledWith(f.tx, f.actor, f.v11.id, id(52));
  });
});
