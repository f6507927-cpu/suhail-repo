import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ requireRole: vi.fn(), withAdminAction: vi.fn(), select: vi.fn(), recordPublication: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: auth.revalidatePath }));
vi.mock("../src/lib/auth/guards", () => ({ requireRole: auth.requireRole }));
vi.mock("../src/lib/auth/actions", () => ({ withAdminAction: auth.withAdminAction }));
vi.mock("../src/db/app", () => ({ dbApp: { select: auth.select } }));
vi.mock("../src/lib/research/publication", () => ({ recordPublication: auth.recordPublication }));
import { changeResearchGate, changeResearchPublication, reconcileResearchDraft, requestResearchDraft, requestResearchRefresh } from "../src/lib/research/actions";
beforeEach(() => { vi.resetAllMocks(); auth.requireRole.mockResolvedValue({}); });
describe("PR19 actual server action boundaries", () => {
  it.each([["draft", requestResearchDraft, "security_id"], ["refresh", requestResearchRefresh, "draft_id"]] as const)(
    "refuses a real %s request in the test environment before any database access", async (_kind, action, field) => {
      const form = new FormData();
      form.set(field, "00000000-0000-4000-8000-000000000001");
      expect(await action(form)).toMatchObject({ ok: false });
      expect(auth.requireRole).toHaveBeenCalledWith(["admin", "editor"]);
      expect(auth.select).not.toHaveBeenCalled();
      expect(auth.withAdminAction).not.toHaveBeenCalled();
    });
  it.each([
    ["", "lawyer-ref"], ["216", "lawyer-ref"], ["D-", "lawyer-ref"],
    ["D-217", ""], ["D-217", "   "],
  ])("gate action refuses enablement with decision %j and lawyer %j before any DB write", async (decision, lawyer) => {
    const form = new FormData();
    form.set("enabled", "true"); form.set("decision_id", decision); form.set("lawyer_reference", lawyer);
    expect(await changeResearchGate(form)).toEqual(expect.objectContaining({ ok: false }));
    expect(auth.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(auth.withAdminAction).not.toHaveBeenCalled();
  });
  it.each([changeResearchGate, changeResearchPublication, reconcileResearchDraft])("requires admin access before processing an action", async action => {
    auth.requireRole.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(action(new FormData())).rejects.toThrow("Forbidden");
    expect(auth.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(auth.withAdminAction).not.toHaveBeenCalled();
  });
  it("refuses gate enablement with valid evidence while O-13 and O-11 are unresolved", async () => {
    const form = new FormData();
    form.set("enabled", "true"); form.set("decision_id", "D-223"); form.set("lawyer_reference", "test-only evidence");
    expect(await changeResearchGate(form)).toEqual({ ok: false,
      message: "Publishing remains off pending Arabic copy and Shariah review (O-13 and O-11)." });
    expect(auth.withAdminAction).not.toHaveBeenCalled();
  });
  it("runs each publication transition within the admin transaction before revalidating stock pages", async () => {
    const tx = { marker: "transaction" }, actor = { id: "fixture-actor" };
    const id = "00000000-0000-4000-8000-000000000001";
    auth.withAdminAction.mockImplementation(async (_, work) => work(tx, actor));
    for (const kind of ["published", "updated", "withdrawn"]) {
      auth.revalidatePath.mockClear();
      auth.recordPublication.mockImplementationOnce(async () => {
        expect(auth.revalidatePath).not.toHaveBeenCalled();
      });
      const form = new FormData(); form.set("draft_id", id); form.set("kind", kind);
      if (kind === "withdrawn") form.set("reason", "evidence_corrected");
      expect(await changeResearchPublication(form)).toEqual({ ok: true, id });
      expect(auth.withAdminAction).toHaveBeenLastCalledWith(["admin"], expect.any(Function));
      expect(auth.recordPublication).toHaveBeenLastCalledWith(tx, actor, id, kind, kind === "withdrawn" ? "evidence_corrected" : null);
      for (const prefix of ["", "/ar", "/en"]) expect(auth.revalidatePath).toHaveBeenCalledWith(`${prefix}/stock/[slug]`, "page");
    }
  });
  it("does not invalidate public pages when the gate refuses a publication", async () => {
    auth.withAdminAction.mockImplementation(async (_, work) => work({}, {}));
    auth.recordPublication.mockRejectedValueOnce(new Error("Research publishing gate is off"));
    const form = new FormData(); form.set("draft_id", "00000000-0000-4000-8000-000000000001"); form.set("kind", "published");
    expect(await changeResearchPublication(form)).toMatchObject({ ok: false });
    expect(auth.revalidatePath).not.toHaveBeenCalled();
  });
});
