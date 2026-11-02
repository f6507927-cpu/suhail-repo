import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { priceBar, priceTargetClaim, source } from "../src/db/schema/market";
import { monthWindow } from "../src/ingest/prices/calendar";
import { validateClose } from "../src/ingest/prices/api-ninjas";

const fake = vi.hoisted(() => ({
  reads: [] as unknown[][], writes: [] as { table: unknown; values: Record<string, unknown> }[],
  sql: [] as unknown[], claim: true,
  usage: new Map<string, { used: number; cap: number }>(),
  context: { s: { id: "s", company_id: "c", ticker: "AAPL", exchange_code: "NASDAQ",
    currency: "USD", in_universe: true, listing_status: "listed" }, c: { id: "c" } },
  refresh: vi.fn(), audit: vi.fn(),
  now: "2026-10-01T12:00:00Z",
}));
vi.mock("server-only", () => ({}));
vi.mock("../src/lib/financial/persistence", () => ({ securityContext: vi.fn(async () => fake.context) }));
vi.mock("../src/lib/financial/market-value-persistence", () => ({ refreshMarketValue: fake.refresh }));
vi.mock("../src/lib/auth/audit", () => ({ audit: fake.audit }));
vi.mock("../src/db/app", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  let queue = Promise.resolve<unknown>(undefined);
  const tx = {
    execute: async (statement: SQL) => {
      const query = dialect.sqlToQuery(statement);
      if (query.sql.includes("select clock_timestamp() as now")) return [{ now: fake.now }];
      fake.sql.push(statement);
      const month = String(query.params[0]);
      const actualMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
        year: "numeric", month: "2-digit" }).format(new Date(fake.now));
      if (month !== actualMonth) return [];
      if (query.sql.includes("insert into app.price_call_usage")) {
        const cap = Number(query.params[1]), existing = fake.usage.get(month);
        fake.usage.set(month, existing ? { ...existing, cap: Math.min(existing.cap, cap) } : { used: 0, cap });
        return [{ month }];
      }
      const row = fake.usage.get(month)!;
      if (row.used >= row.cap) return [];
      row.used++;
      return [{ used: row.used }];
    },
    select: () => ({ from: () => ({ where: () => ({ limit: async () => fake.reads.shift() ?? [] }) }) }),
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      fake.writes.push({ table, values });
      return {
        returning: async () => [{ id: "inserted" }],
        onConflictDoNothing: () => ({ returning: async () => fake.claim ? [{ id: "claim" }] : [] }),
        onConflictDoUpdate: async () => {},
      };
    } }),
  };
  return { dbApp: { ...tx,
    transaction: async (callback: (t: typeof tx) => Promise<unknown>) => {
      // Fake row-lock serialization. No PostgreSQL or migration is involved.
      const result = queue.then(async () => {
        const before = fake.writes.length;
        const usage = new Map([...fake.usage].map(([key, row]) => [key, { ...row }]));
        try { return await callback(tx); }
        catch (e) { fake.writes.splice(before); fake.usage = usage; throw e; }
      });
      queue = result.catch(() => undefined);
      return result;
    },
  } };
});
import { budgetStore, realStore } from "../src/ingest/prices/persistence";

const target = { id: "s", ticker: "AAPL", exchange: "NASDAQ", currency: "USD" };
const w = monthWindow("2026-09");
const close = validateClose({ ticker: "AAPL", exchange: "NASDAQ", currency: "USD", price: 200,
  updated: +w.close / 1000, volume: 100, previous_close: 199, change: 1 }, target, w, new Date("2026-10-01T12:00Z"));
beforeEach(() => {
  fake.reads = []; fake.writes = []; fake.sql = []; fake.claim = true; fake.usage = new Map();
  fake.refresh.mockReset(); fake.audit.mockReset();
  fake.now = "2026-10-01T12:00:00Z";
});
describe("D-153 real persistence adapter against fake transaction storage (no PostgreSQL)", () => {
  it("reserves with a row-locked cap upsert and conditional increment in one transaction", async () => {
    expect(await budgetStore.reserveCall("2026-10", 500)).toBe(true);
    expect(fake.sql).toHaveLength(2);
    const query = new PgDialect().sqlToQuery(fake.sql[0] as SQL);
    expect(query.sql).toContain("on conflict (month) do update");
    expect(query.sql).toContain("cap = least(price_call_usage.cap, excluded.cap)");
    expect(query.sql).toContain("clock_timestamp() at time zone 'America/New_York'");
    expect(query.params).toContain("2026-10"); expect(query.params).toContain(500);
    const increment = new PgDialect().sqlToQuery(fake.sql[1] as SQL);
    expect(increment.sql).toContain("set used = used + 1");
    expect(increment.sql).toContain("used < cap");
    fake.usage.set("2026-10", { used: 500, cap: 500 });
    expect(await budgetStore.reserveCall("2026-10", 500)).toBe(false);
  });
  it("commits a lowered cap below used calls and denies a later old-cap process", async () => {
    fake.usage.set("2026-10", { used: 400, cap: 500 });
    expect(await budgetStore.reserveCall("2026-10", 100)).toBe(false);
    expect(fake.usage.get("2026-10")).toEqual({ used: 400, cap: 100 });
    expect(await budgetStore.reserveCall("2026-10", 500)).toBe(false);
    expect(fake.usage.get("2026-10")).toEqual({ used: 400, cap: 100 });
  });
  it("denied equal caps and concurrent old-cap attempts never increment usage", async () => {
    fake.usage.set("2026-10", { used: 400, cap: 500 });
    expect(await budgetStore.reserveCall("2026-10", 400)).toBe(false);
    expect(await Promise.all(Array.from({ length: 5 }, () => budgetStore.reserveCall("2026-10", 500))))
      .toEqual([false, false, false, false, false]);
    expect(fake.usage.get("2026-10")).toEqual({ used: 400, cap: 400 });
  });
  it("serializes concurrent final reservations and resets only in the actual Eastern call month", async () => {
    fake.usage.set("2026-10", { used: 499, cap: 500 });
    expect(await Promise.all([budgetStore.reserveCall("2026-10", 500), budgetStore.reserveCall("2026-10", 500)]))
      .toEqual([true, false]);
    expect(fake.usage.get("2026-10")?.used).toBe(500);
    expect(await budgetStore.reserveCall("2026-09", 500)).toBe(false);
    expect(fake.usage.has("2026-09")).toBe(false);
    fake.now = "2026-11-01T06:00Z";
    expect(await budgetStore.reserveCall("2026-11", 500)).toBe(true);
    expect(fake.usage.get("2026-11")).toEqual({ used: 1, cap: 500 });
  });
  it("existing date or month evidence does not create a target claim", async () => {
    fake.reads = [[{ id: "manual-or-csv" }]];
    expect(await realStore.claim(target, w.date, w.monthEnd)).toBe(false);
    expect(fake.writes).toEqual([]);
  });
  it("unique target-claim conflict prevents a second request", async () => {
    fake.claim = false;
    expect(await realStore.claim(target, w.date, w.monthEnd)).toBe(false);
    expect(fake.writes[0]).toEqual({ table: priceTargetClaim,
      values: { security_id: "s", month_end_for: "2026-09-30" } });
  });
  it.each(["price", "previous_close"] as const)("%s cannot replace a manual correction arriving during HTTP", async field => {
    fake.reads = [[{ id: "new-manual" }]];
    fake.now = new Date(+w.nextClose + 1000).toISOString();
    const accepted = field === "price" ? close : validateClose({
      ticker: "AAPL", exchange: "NASDAQ", currency: "USD", price: 200,
      previous_close: 199, updated: +w.nextClose / 1000,
    }, target, w, new Date(fake.now));
    await realStore.save(target, accepted);
    expect(fake.writes).toEqual([]); expect(fake.refresh).not.toHaveBeenCalled(); expect(fake.audit).not.toHaveBeenCalled();
  });
  it.each(["price", "previous_close"] as const)("saves %s with API Ninjas provenance and the month-end trading date", async field => {
    fake.now = new Date(+w.nextClose + 1000).toISOString();
    const accepted = field === "price" ? close : validateClose({
      ticker: "AAPL", exchange: "NASDAQ", currency: "USD", price: 200,
      previous_close: 199, updated: +w.nextClose / 1000,
    }, target, w, new Date(fake.now));
    await realStore.save(target, accepted);
    expect(fake.writes).toHaveLength(2);
    expect(fake.writes[0]).toMatchObject({ table: source, values: { label: "API Ninjas", provider: "API Ninjas",
      retrieved_at: accepted.retrieved, source_url: accepted.sourceUrl, reporting_period: w.monthEnd,
      document_reference: `updated=${accepted.updated.toISOString()}` } });
    expect(fake.writes[1]).toEqual({ table: priceBar, values: {
      security_id: "s", ticker: "AAPL", date: w.date, month_end_for: w.monthEnd,
      close: accepted.close, currency: "USD", price_provider: "API Ninjas", provider_updated_at: accepted.updated,
      source_id: "inserted", source_label: "API Ninjas", source_url: accepted.sourceUrl, is_synthetic: false,
    } });
    expect(fake.refresh).toHaveBeenCalledOnce(); expect(fake.audit).toHaveBeenCalledOnce();
  });
  it("refresh failure rolls back accepted price and source together in the fake transaction", async () => {
    fake.refresh.mockRejectedValueOnce(new Error("refresh failed"));
    await expect(realStore.save(target, close)).rejects.toThrow("refresh failed");
    expect(fake.writes).toEqual([]); expect(fake.audit).not.toHaveBeenCalled();
  });
  it("an issuer-lock wait crossing the next close cannot write a price or source", async () => {
    fake.now = w.endClose.toISOString();
    await expect(realStore.save(target, close)).rejects.toThrow("Next trading session");
    expect(fake.writes).toEqual([]);
  });
});
