import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ requireRole: vi.fn(), withAdminAction: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/lib/auth/guards", () => ({ requireRole: auth.requireRole }));
vi.mock("../src/lib/auth/actions", () => ({ withAdminAction: auth.withAdminAction }));
vi.mock("../src/db/app", () => ({ dbApp: { select: auth.select } }));
import { changeResearchGate, reconcileResearchDraft, requestResearchDraft, requestResearchRefresh } from "../src/lib/research/actions";
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
  it.each([changeResearchGate, reconcileResearchDraft])("requires admin access before processing an action", async action => {
    auth.requireRole.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(action(new FormData())).rejects.toThrow("Forbidden");
    expect(auth.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(auth.withAdminAction).not.toHaveBeenCalled();
  });
});
