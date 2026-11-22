import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ requireRole: vi.fn(), withAdminAction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/lib/auth/guards", () => ({ requireRole: auth.requireRole }));
vi.mock("../src/lib/auth/actions", () => ({ withAdminAction: auth.withAdminAction }));
import { changeResearchGate, reconcileResearchDraft } from "../src/lib/research/actions";
beforeEach(() => { vi.resetAllMocks(); auth.requireRole.mockResolvedValue({}); });
describe("PR19 actual server action boundaries", () => {
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
  it.each([changeResearchGate, reconcileResearchDraft])("requires admin access before processing an action", async action => {
    auth.requireRole.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(action(new FormData())).rejects.toThrow("Forbidden");
    expect(auth.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(auth.withAdminAction).not.toHaveBeenCalled();
  });
});
