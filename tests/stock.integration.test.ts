import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import { createDemoFixtures, assertDemoMode } from "../scripts/db/seed-demo";
import { loadPublicStock } from "../src/db/stock-public";
import { screenSecurity } from "../src/screening/service";
import * as schema from "../src/db/schema";
import type { Tx } from "../src/lib/auth/audit";
vi.mock("server-only", () => ({}));
let client: Sql;
const rollback = new Error("rollback isolated public stock fixture");
beforeEach(() => { vi.stubEnv("SITE_MODE", "preview"); });
afterEach(() => { vi.unstubAllEnvs(); });
beforeAll(async () => {
  client = cliConnection("DATABASE_URL_TEST");
  await applyMigrations(client);
  await seedDatabase(client);
});
afterAll(async () => { await client?.end(); });
async function isolated(work: (tx: Tx) => Promise<void>) {
  try {
    await drizzle(client, { schema }).transaction(async tx => {
      await tx.execute(sql`set local role suhail_app`);
      await createDemoFixtures(tx);
      await work(tx);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
describe("public stock role and synthetic-only development seed", () => {
  it("public role reads four actual engine statuses, sources and no private payload", async () => isolated(async tx => {
    await tx.execute(sql`set local role suhail_public`);
    expect((await tx.execute<{ current_user: string }>(sql`select current_user`))[0].current_user).toBe("suhail_public");
    for (const [slug, status] of [["demo-fixa", "passes_selected_methodology"], ["demo-fixb", "requires_review"], ["demo-fixc", "fails_selected_methodology"], ["demo-fixd", "insufficient_data"]]) {
      const page = await loadPublicStock(slug, tx);
      expect(page?.run?.status).toBe(status);
      expect(page?.criteria).toHaveLength(5);
      expect(page?.sources.some(s => s.document_reference?.includes("FIXTURE-"))).toBe(true);
      expect(page?.run?.calculation_version).toBe("calc-2026.10.6");
      expect(page?.period?.reported_date).toBe("2026-02-01");
      expect(JSON.stringify(page)).not.toContain("hash_payload");
    }
    // Use a savepoint so deliberate permission denial does not abort the fixture.
    await expect(tx.transaction(async nested => nested.execute(sql`select hash_payload from app.screening_run limit 1`))).rejects.toThrow();
  }));
  it("RLS and loader both hide an out-of-universe security; no-run stays explicit", async () => isolated(async tx => {
    await tx.execute(sql`set local role suhail_public`);
    expect(await loadPublicStock("demo-hidden", tx)).toBeNull();
    expect(await tx.select({ id: schema.security.id }).from(schema.security).where(eq(schema.security.slug, "demo-hidden"))).toEqual([]);
    const page = await loadPublicStock("demo-new", tx);
    expect(page?.company.name).toBe("Fixture New Co");
    expect(page?.run).toBeNull();
    expect(page?.criteria).toEqual([]);
  }));
  it("current facts can change without rewriting the run's evidence", async () => isolated(async tx => {
    const before = await loadPublicStock("demo-fixa", tx);
    await tx.update(schema.financialFact).set({ value: 999 }).where(eq(schema.financialFact.id, before!.facts.find(f => f.line_item === "total_assets")!.id));
    await tx.execute(sql`set local role suhail_public`);
    const after = await loadPublicStock("demo-fixa", tx);
    expect(after?.criteria).toEqual(before?.criteria);
    expect(after?.facts.find(f => f.line_item === "total_assets")?.value).toBe(999);
  }));
  it("repeated demo seed does not duplicate runs or securities", async () => isolated(async tx => {
    const again = await createDemoFixtures(tx);
    expect(again.filter(row => "unchanged" in row).every(row => row.unchanged)).toBe(true);
    const page = await loadPublicStock("demo-fixa", tx);
    expect(page?.priorRuns).toEqual([]);
  }));
  it("live seed refuses before writes and a real issuer cannot use demo-seed", async () => isolated(async tx => {
    try {
      vi.stubEnv("SITE_MODE", "live");
      expect(() => assertDemoMode()).toThrow("refuses");
      await expect(createDemoFixtures(tx)).rejects.toThrow("refuses");
      vi.stubEnv("NODE_ENV", "production");
      const [s] = await tx.select().from(schema.security).where(eq(schema.security.slug, "demo-fixa"));
      const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_name, "Example Methodology A"));
      await expect(screenSecurity(s.id, v.id, { asOf: "2026-10-16", trigger: "demo-seed" }, work => work(tx, null))).rejects.toThrow("cannot screen live");
      vi.stubEnv("SITE_MODE", "preview");
      const [c] = await tx.insert(schema.company).values({ name: "Fixture non-demo issuer", is_demo: false }).returning();
      const [real] = await tx.insert(schema.security).values({ ticker: "REALFIX", slug: "fixture-real-boundary", company_id: c.id, in_universe: true }).returning();
      await tx.insert(schema.financialPeriod).values({ company_id: c.id, period_type: "annual", fiscal_year: 2025, fiscal_period_label: "Fixture period", period_end: "2025-12-31", is_latest: true });
      await expect(screenSecurity(real.id, v.id, { asOf: "2026-10-16", trigger: "demo-seed" }, work => work(tx, null))).rejects.toThrow("cannot screen live");
    } finally { vi.unstubAllEnvs(); }
  }));
});
