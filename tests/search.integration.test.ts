import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import { createDemoFixtures } from "../scripts/db/seed-demo";
import { searchPublicStocks } from "../src/db/search-public";
import * as schema from "../src/db/schema";
import type { Tx } from "../src/lib/auth/audit";
vi.mock("server-only", () => ({}));
let client: Sql;
const rollback = new Error("rollback isolated search fixture");
beforeAll(async () => {
  client = cliConnection("DATABASE_URL_TEST");
  await applyMigrations(client);
  await seedDatabase(client);
});
afterAll(async () => { await client?.end(); });
beforeEach(() => { vi.stubEnv("SITE_MODE", "preview"); });
afterEach(() => { vi.unstubAllEnvs(); });

async function isolated(work: (tx: Tx) => Promise<void>) {
  try {
    await drizzle(client, { schema }).transaction(async tx => {
      await tx.execute(sql`set local role suhail_app`);
      await createDemoFixtures(tx);
      const [exchange] = await tx.select().from(schema.exchange).where(eq(schema.exchange.code, "NASDAQ"));
      for (const [index, name, name_ar, ticker, extra] of [
        [0, "SearchFixture MixedCase Orchard", "أبل إيمان آفاق مدرسة فتى مـدّ", "SFXABC", {}],
        [1, "SearchFixture literals %_\\ marker", "ابل ايمان افاق مدرسه فتي مد", "SFXLIT", {}],
        [2, "SearchFixture outside", null, "SFXOUT", { in_universe: false }],
        [3, "SearchFixture delisted", null, "SFXDEL", { listing_status: "delisted" }],
        [4, "SearchFixture real issuer", null, "SFXREAL", { is_demo: false }],
        [5, "SearchFixture demo company", null, "SFXDC", { is_demo: false }],
      ] as const) {
        const [c] = await tx.insert(schema.company).values({ name, name_ar, is_demo: index !== 4 }).returning();
        await tx.insert(schema.security).values({
          slug: `search-fixture-${index}`, ticker, company_id: c.id,
          exchange_id: exchange.id, is_demo: true, in_universe: true, listing_status: "listed", ...extra,
        });
      }
      await work(tx);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
const asPublic = (tx: Tx) => tx.execute(sql`set local role suhail_public`);
describe("search through real PostgreSQL public role", () => {
  it("matches ticker prefix but not ticker substring; names are case-insensitive substrings", () => isolated(async tx => {
    await asPublic(tx);
    expect((await searchPublicStocks(" sfxa ", tx)).map(r => r.ticker)).toEqual(["SFXABC"]);
    expect(await searchPublicStocks("FXABC", tx)).toEqual([]);
    expect((await searchPublicStocks("XEDcase orch", tx))[0].ticker).toBe("SFXABC");
    expect((await searchPublicStocks("sfx", tx)).map(r => r.ticker)).toEqual(["SFXABC", "SFXDC", "SFXLIT", "SFXREAL"]);
    expect((await searchPublicStocks("sfxa", tx))[0].exchange).toBe("NASDAQ");
  }));
  it("normalizes Arabic symmetrically, preserving stored display names", () => isolated(async tx => {
    await asPublic(tx);
    for (const query of ["ابل", "أبل", "إبل", "آبل", "ايمان", "إيمان", "افاق", "آفاق", "مدرسه", "مدرسة", "فتي", "فتى", "مـدّ", "مد", "أَبـل"]) {
      const results = await searchPublicStocks(query, tx);
      expect(results.map(r => r.ticker), query).toEqual(["SFXABC", "SFXLIT"]);
      expect(results[0].name_ar).toBe("أبل إيمان آفاق مدرسة فتى مـدّ");
    }
    for (const query of ["ـ", "َ", "ـّـ", "ٰؐۖ"]) expect(await searchPublicStocks(query, tx), query).toEqual([]);
  }));
  it("escapes wildcard, backslash and SQL injection characters literally", () => isolated(async tx => {
    await asPublic(tx);
    for (const query of ["%", "_", "\\", "%_\\"]) {
      expect((await searchPublicStocks(query, tx)).map(r => r.ticker), query).toEqual(["SFXLIT"]);
    }
    expect(await searchPublicStocks("' OR 1=1 --", tx)).toEqual([]);
    expect(await searchPublicStocks("nothing-matches-this", tx)).toEqual([]);
  }));
  it("validates before database access, including whitespace and the 40-character boundary", () => isolated(async tx => {
    const [c] = await tx.insert(schema.company).values({ name: "Q".repeat(40), is_demo: true }).returning();
    await tx.insert(schema.security).values({ ticker: "SFQ", slug: "search-fixture-bounds", company_id: c.id, in_universe: true, is_demo: true });
    await asPublic(tx);
    expect((await searchPublicStocks(` ${"Q".repeat(40)} `, tx))[0].ticker).toBe("SFQ");
    for (const query of ["", " \t\n ", "Q".repeat(41)]) expect(await searchPublicStocks(query, tx)).toEqual([]);
  }));
  it("filters before the ten-row database limit; live excludes either demo flag", () => isolated(async tx => {
    for (let i = 0; i < 14; i++) {
      const [c] = await tx.insert(schema.company).values({ name: `LimitSearch fixture ${i}`, is_demo: false }).returning();
      await tx.insert(schema.security).values({ ticker: `LMT${String(i).padStart(2, "0")}`, slug: `search-limit-${i}`, company_id: c.id, in_universe: true, is_demo: false });
    }
    await asPublic(tx);
    const results = await searchPublicStocks("LimitSearch", tx);
    expect(results).toHaveLength(10);
    expect(results.map(r => r.ticker)).toEqual(Array.from({ length: 10 }, (_, i) => `LMT0${i}`));
    vi.stubEnv("SITE_MODE", "live");
    expect((await searchPublicStocks("sfx", tx)).map(r => r.ticker)).toEqual(["SFXREAL"]);
    expect(await searchPublicStocks("FIXA", tx)).toEqual([]);
  }));
  it("uses only the visible editorial default and deterministic latest run, never evidence or another version", () => isolated(async tx => {
    const [s] = await tx.select().from(schema.security).where(eq(schema.security.slug, "demo-fixa"));
    const [run] = await tx.select().from(schema.screeningRun).where(eq(schema.screeningRun.security_id, s.id));
    const stamp = new Date("2030-01-01T00:00:00Z");
    for (const [id, created, generated, status] of [
      ["10000000-0000-4000-8000-000000000001", stamp, stamp, "requires_review"],
      ["10000000-0000-4000-8000-000000000002", stamp, stamp, "fails_selected_methodology"],
      ["10000000-0000-4000-8000-000000000003", new Date("2029-01-01"), stamp, "insufficient_data"],
      ["10000000-0000-4000-8000-000000000004", new Date("2031-01-01"), new Date("2029-01-01"), "insufficient_data"],
    ] as const) await tx.insert(schema.screeningRun).values({ ...run, id, created_at: created, generated_at: generated, status });
    await asPublic(tx);
    expect((await searchPublicStocks("FIXA", tx))[0].status).toBe("fails_selected_methodology");
    expect((await searchPublicStocks("FIXB", tx))[0].status).toBe("requires_review");
    expect((await searchPublicStocks("FIXN", tx))[0].status).toBeNull();
    await tx.execute(sql`set local role suhail_app`);
    await tx.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: null });
    await asPublic(tx);
    expect((await searchPublicStocks("FIXA", tx))[0].status).toBeNull();
    await tx.execute(sql`set local role suhail_app`);
    const [b] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_name, "Example Methodology B"));
    await tx.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: b.id });
    await asPublic(tx);
    expect((await searchPublicStocks("FIXA", tx))[0].status).toBeNull();
  }));
});
