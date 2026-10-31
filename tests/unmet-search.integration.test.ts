import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { databaseUrl } from "../src/db/connection-url";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { searchPublicStocks } from "../src/db/search-public";
import { normalizeSearch } from "../src/lib/search-normalization";
vi.mock("server-only", () => ({}));
let client: Sql;
beforeAll(async () => { client = cliConnection("DATABASE_URL_TEST"); await applyMigrations(client); });
afterAll(async () => { await client?.end(); });
describe("anonymous unmet search storage", () => {
  it("operator retention preserves the UTC boundary, deletes only older days and is repeatable", async () => {
    await client.begin(async tx => {
      await tx`insert into app.unmet_search(normalized_query,calendar_day,count) values
        ('retention-old', (current_timestamp at time zone 'UTC')::date - 91, 2),
        ('retention-boundary', (current_timestamp at time zone 'UTC')::date - 90, 3),
        ('retention-recent', (current_timestamp at time zone 'UTC')::date, 4)`;
      expect((await tx`select app.cleanup_unmet_search() as removed`)[0].removed).toBe("1");
      expect((await tx`select app.cleanup_unmet_search() as removed`)[0].removed).toBe("0");
      expect((await tx`select count::int from app.unmet_search where normalized_query like 'retention-%' order by count`).map(r => r.count)).toEqual([3, 4]);
      for (const role of ["suhail_app", "suhail_public"]) {
        await tx.savepoint(async sp => {
          await sp.unsafe(`set local role ${role}`);
          await expect(sp.savepoint(current => current`select app.cleanup_unmet_search()`)).rejects.toMatchObject({ code: "42501" });
          await sp`reset role`;
        });
      }
      await tx`delete from app.unmet_search where normalized_query like 'retention-%'`;
    });
  });
  it("optional whole-transaction timeout applies on PostgreSQL 17 without entering the migration journal", async () => {
    const optional = readFileSync("scripts/db/optional/transaction-timeout.sql", "utf8");
    expect(readFileSync("drizzle/meta/_journal.json", "utf8")).not.toContain("transaction-timeout");
    expect(optional).toContain(">= 170000");
    expect(optional).toContain("Skipped:");
    const [role] = await client`select rolcanlogin from pg_roles where rolname='suhail_app'`;
    const url = new URL(databaseUrl("DATABASE_URL_TEST", testDatabaseUrl()));
    url.username = "suhail_app"; url.password = "";
    let session: Sql | undefined;
    try {
      await client.unsafe(optional);
      await client`alter role suhail_app login`;
      session = postgres(url.href, { max: 1, prepare: false });
      expect((await session`show transaction_timeout`)[0].transaction_timeout).toBe("1min");
      expect((await session`select setting from pg_settings where name='transaction_timeout'`)[0].setting).toBe("60000");
    } finally {
      await session?.end();
      await client`alter role suhail_app reset transaction_timeout`;
      if (!role.rolcanlogin) await client`alter role suhail_app nologin`;
    }
    // Exercise the skip branch on PG17, not a claim of testing a PG16 server.
    await client.unsafe(optional.replace("current_setting('server_version_num')::integer", "160000"));
    expect((await client`select rolconfig from pg_roles where rolname='suhail_app'`)[0].rolconfig).not.toContain("transaction_timeout=60s");
  });
  it("is exactly query/day/count with RLS and no anonymous table grants", async () => {
    const columns = await client`select column_name from information_schema.columns where table_schema='app' and table_name='unmet_search' order by ordinal_position`;
    expect(columns.map(c => c.column_name)).toEqual(["normalized_query", "calendar_day", "count"]);
    const [rls] = await client`select relrowsecurity from pg_class where oid='app.unmet_search'::regclass`;
    expect(rls.relrowsecurity).toBe(true);
    await client.begin(async tx => {
      await tx`set local role suhail_public`;
      await expect(tx.savepoint(sp => sp`select * from app.unmet_search`)).rejects.toMatchObject({ code: "42501" });
      await expect(tx.savepoint(sp => sp`insert into app.unmet_search values('forbidden','2026-10-19',1)`)).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("normalizes across locales, atomically counts concurrent misses, and permits no public reads", async () => {
    const suffix = randomUUID().slice(0, 8);
    const raw = `أبلـ مُدرَسة ${suffix}`;
    const normalized = normalizeSearch(raw);
    // Each transaction uses only the public role; concurrent function writes are atomic.
    await Promise.all(Array.from({ length: 30 }, (_, i) => client.begin(async tx => {
      await tx`set local role suhail_public`;
      await tx`select app.record_unmet_search(${i % 2 ? normalized.toUpperCase() : ` ${raw} `})`;
    })));
    const rows = await client`select normalized_query, calendar_day::text, count::int from app.unmet_search where normalized_query=${normalized}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(30);
    expect(rows[0].calendar_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await client`delete from app.unmet_search where normalized_query=${normalized}`;
  });
  it("successful valid zero matches increment, invalid/normalized-empty queries do not", async () => {
    const query = `unmet-${randomUUID().slice(0, 8)}`;
    await drizzle(client).transaction(async db => {
      await db.execute(sql`set local role suhail_public`);
      expect(await searchPublicStocks(query, db)).toEqual([]);
      expect(await searchPublicStocks("ـ", db)).toEqual([]);
      expect(await searchPublicStocks(["bad"], db)).toEqual([]);
      expect(await searchPublicStocks("", db)).toEqual([]);
    });
    const [row] = await client`select count::int from app.unmet_search where normalized_query=${query}`;
    expect(row.count).toBe(1);
    expect(await client`select * from app.unmet_search where normalized_query=''`).toHaveLength(0);
    await client`delete from app.unmet_search where normalized_query=${query}`;
  });
});
