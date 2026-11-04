import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { company } from "../src/db/schema/market";
import { mutateFinancial } from "../src/lib/financial/service";
import type { Tx } from "../src/lib/auth/audit";

const spies = vi.hoisted(() => ({ audit: vi.fn(), context: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/auth/audit", () => ({ audit: spies.audit }));
vi.mock("../src/lib/financial/persistence", async original => ({
  ...await original<typeof import("../src/lib/financial/persistence")>(),
  securityContext: spies.context,
}));

const actor = { id: "admin-id", email: null, role: "admin" as const };
const securityId = "10000000-0000-4000-8000-000000000001";
const fields = { name_ar: "", description_ar: "", description_en: "" };
const before = { id: "company-id", name: "COCA COLA CO", display_name_en: "Old display" };
function transaction() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  return { tx: { update: vi.fn(() => ({ set })) } as unknown as Tx, set };
}
beforeEach(() => {
  vi.clearAllMocks();
  spies.context.mockResolvedValue({ s: { id: "security-id" }, c: before });
  spies.audit.mockResolvedValue(undefined);
});

describe("D-148 audited company display-name curation", () => {
  it("trims the curated name and audits before/after in the same transaction", async () => {
    const { tx, set } = transaction();
    await mutateFinancial(tx, actor, { operation: "company", securityId,
      data: { ...fields, display_name_en: "  Coca-Cola  ", name: "Cannot replace SEC identity" } });
    expect(tx.update).toHaveBeenCalledWith(company);
    expect(set).toHaveBeenCalledWith({ ...fields, display_name_en: "Coca-Cola" });
    expect(spies.audit).toHaveBeenCalledWith(tx, actor, expect.objectContaining({
      entity_name: "security", entity_id: "security-id",
      details: { display_name_en_before: "Old display", display_name_en_after: "Coca-Cola" },
    }));
    expect(set.mock.calls[0][0]).not.toHaveProperty("name");
    expect(before.name).toBe("COCA COLA CO");
  });
  it.each(["", "  \n ", null])("clears %j to SQL null for SEC-name fallback", async display_name_en => {
    const { tx, set } = transaction();
    await mutateFinancial(tx, actor, { operation: "company", securityId,
      data: { ...fields, display_name_en } });
    expect(set).toHaveBeenCalledWith({ ...fields, display_name_en: null });
    expect(spies.audit.mock.calls[0][2].details.display_name_en_after).toBeNull();
  });
  it("leaves an omitted display name unchanged for older company-editor callers", async () => {
    const { tx } = transaction();
    await mutateFinancial(tx, actor, { operation: "company", securityId, data: fields });
    expect(spies.audit.mock.calls[0][2].details.display_name_en_after).toBe("Old display");
  });
  it.each(["x".repeat(1001), 123])("rejects an invalid display name before writing", async display_name_en => {
    const { tx } = transaction();
    await expect(mutateFinancial(tx, actor, { operation: "company", securityId,
      data: { ...fields, display_name_en } })).rejects.toThrow();
    expect(tx.update).not.toHaveBeenCalled();
    expect(spies.audit).not.toHaveBeenCalled();
  });
  it("does not swallow an audit failure that must roll the transaction back", async () => {
    const { tx } = transaction();
    spies.audit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(mutateFinancial(tx, actor, { operation: "company", securityId,
      data: { ...fields, display_name_en: "Coca-Cola" } })).rejects.toThrow("audit unavailable");
  });
  it("registers a new additive nullable migration with matching Drizzle metadata", () => {
    const sql = readFileSync("drizzle/0015_company_display_name_en.sql", "utf8");
    expect(sql.trim()).toBe('ALTER TABLE "app"."company" ADD COLUMN "display_name_en" text;');
    expect(company.display_name_en.notNull).toBe(false);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ idx: 15, tag: "0015_company_display_name_en" }),
    ]));
    const snapshot = JSON.parse(readFileSync("drizzle/meta/0015_snapshot.json", "utf8"));
    expect(snapshot.tables["app.company"].columns.display_name_en).toMatchObject({ type: "text", notNull: false });
  });
  it("grants only the approved new public column in a separate additive migration", () => {
    const sql = readFileSync("drizzle/0016_company_display_name_en_public_read.sql", "utf8");
    expect(sql).toContain("GRANT SELECT (display_name_en) ON app.company TO suhail_public;");
    expect(sql).not.toMatch(/GRANT ALL|GRANT UPDATE|GRANT INSERT|GRANT DELETE/);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ idx: 16, tag: "0016_company_display_name_en_public_read" }),
    ]));
  });
});
