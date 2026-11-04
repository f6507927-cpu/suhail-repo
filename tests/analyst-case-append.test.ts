import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const audit = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth/audit", () => ({ audit }));
import { appendCases, saveCases } from "../src/lib/methodology/service";
import { canAppendAnalystCases } from "../src/lib/methodology/analyst-case-policy";
import { v11Cases } from "../src/lib/methodology/v11-cases";
import { proposedV11Definition } from "../src/lib/methodology/proposed-v1.1";
import { criterionSchema } from "../src/lib/methodology/contracts";
import type { Tx, AppUser } from "../src/lib/auth/audit";

const id = "00000000-0000-4000-8000-000000000050";
const criteria = proposedV11Definition().criteria.map(({ key: _key, ...c }, i) => {
  void _key; return { ...criterionSchema.parse(c), id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` };
});
const candidates = v11Cases([], [], criteria);
const actor = { id: "fixture-admin" } as AppUser;
function fixture(stage: string, productionEnabled = false) {
  const edited = structuredClone(candidates[0]); edited.inputs.securityId = "owner-edited";
  const version = { id, version: "1.1", workflow_status: stage, production_enabled: productionEnabled,
    analyst_test_cases: [edited] };
  const queue = [[version], [version], criteria];
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn((values: unknown) => { void values; return { where }; });
  const tx = {
    execute: vi.fn().mockResolvedValue([]),
    select: () => ({ from: () => ({ where: () => {
      const rows = queue.shift();
      if (!rows) throw new Error("Unexpected fixture query");
      return Object.assign(Promise.resolve(rows), {
        for: () => Promise.resolve(rows), orderBy: () => Promise.resolve(rows),
      });
    } }) }),
    update: vi.fn(() => ({ set })),
  } as unknown as Tx;
  return { tx, version, set };
}
beforeEach(() => vi.resetAllMocks());
describe("D-156 audited case append service", () => {
  it.each(["draft", "source_verified", "rules_normalized"])("appends only missing cases at %s", async stage => {
    const f = fixture(stage), before = structuredClone(f.version);
    const result = await appendCases(f.tx, actor, id, [...candidates, ...candidates]);
    expect(result).toEqual({ added: candidates.length - 1, total: candidates.length });
    const values = f.set.mock.calls[0][0] as { analyst_test_cases: unknown[] };
    expect(values.analyst_test_cases[0]).toEqual(before.analyst_test_cases[0]);
    expect(Object.keys(values).sort()).toEqual(["analyst_test_cases", "updated_at"]);
    expect(audit).toHaveBeenCalledWith(f.tx, actor, expect.objectContaining({
      summary: "Missing analyst cases appended", details: { added: 7, total: 8, workflow_status: stage },
    }));
    expect(f.version).toEqual(before);
  });
  it.each(["tests_passed", "universe_tested", "human_reviewed", "approved", "production", "unrecognized"])(
    "refuses %s before mutation", async stage => {
      const f = fixture(stage);
      await expect(appendCases(f.tx, actor, id, candidates)).rejects.toThrow("only be added before tests_passed");
      expect(f.tx.update).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
    });
  it("refuses production-enabled versions even with a pre-test workflow status", async () => {
    const f = fixture("rules_normalized", true);
    await expect(appendCases(f.tx, actor, id, candidates)).rejects.toThrow("before tests_passed");
    expect(canAppendAnalystCases("draft", true)).toBe(false);
    expect(audit).not.toHaveBeenCalled();
  });
  it("no-op writes neither timestamps nor audits", async () => {
    const f = fixture("rules_normalized");
    expect(await appendCases(f.tx, actor, id, [candidates[0]])).toEqual({ added: 0, total: 1 });
    expect(f.tx.update).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
  it("retains the draft-only restriction on replacing or editing case lists", async () => {
    const f = fixture("rules_normalized");
    await expect(saveCases(f.tx, actor, id, candidates)).rejects.toThrow("Finalized analyst cases are immutable");
    expect(f.tx.update).not.toHaveBeenCalled();
  });
  it("refuses malformed evidence or foreign criterion expectations before writes", async () => {
    const f = fixture("rules_normalized"), bad = structuredClone(candidates[1]);
    bad.expected.criteria["00000000-0000-4000-8000-000000000099"] = "pass";
    await expect(appendCases(f.tx, actor, id, [bad])).rejects.toThrow("outside this version");
    expect(f.tx.update).not.toHaveBeenCalled(); expect(audit).not.toHaveBeenCalled();
  });
});
