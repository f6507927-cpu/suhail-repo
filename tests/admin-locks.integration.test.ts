import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { applyMigrations } from "../scripts/db/migrate";

vi.mock("server-only", () => ({}));
const boundary = vi.hoisted(() => ({ db: null as unknown, id: "" }));
vi.mock("../src/db/app", () => ({ get dbApp() { return boundary.db; } }));
vi.mock("../src/lib/auth/guards", () => ({
  requireRole: async () => ({ identity: { id: boundary.id } }),
  requireUser: async () => ({ identity: { id: boundary.id } }),
}));
import { withAdminAction, withUserAction } from "../src/lib/auth/actions";
import { changeRole } from "../src/app/[locale]/(private)/admin/(protected)/actions";

let control: Sql, owner: Sql, app: Sql, publicClient: Sql;
let login: { rolname: string; rolcanlogin: boolean }[] = [];
const database = `admin_locks_${randomUUID().replaceAll("-", "")}`;
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function until(check: () => Promise<boolean>, deadline = 3000) {
  const start = Date.now();
  while (!await check()) {
    if (Date.now() - start > deadline) throw new Error("Condition did not become true");
    await pause(20);
  }
}
beforeAll(async () => {
  control = cliConnection("DATABASE_URL_TEST"); // Validated disposable loopback ONLY.
  await control.unsafe(`create database "${database}"`);
  const url = new URL(testDatabaseUrl());
  url.pathname = `/${database}`;
  owner = postgres(url.href, { max: 1, prepare: false, onnotice: () => {} });
  await applyMigrations(owner);
  login = await owner`select rolname,rolcanlogin from pg_roles where rolname in ('suhail_app','suhail_public')`;
  // Local test roles start NOLOGIN. Real logins (not SET ROLE) exercise role defaults.
  await owner`alter role suhail_app login`;
  await owner`alter role suhail_public login`;
  url.username = "suhail_app"; url.password = "";
  app = postgres(url.href, { max: 4, prepare: false, onnotice: () => {} });
  boundary.db = drizzle(app, { schema });
  url.username = "suhail_public";
  publicClient = postgres(url.href, { max: 1, prepare: false, onnotice: () => {} });
  boundary.id = randomUUID();
  await owner`insert into app.users(id,email,full_name,role,terms_version,privacy_version,accepted_at)
    values(${boundary.id},'locks@example.test','Lock fixture','admin','fixture','fixture',now())`;
}, 60000);
afterAll(async () => {
  await app?.end({ timeout: 0 }); await publicClient?.end({ timeout: 0 });
  if (owner) {
    for (const role of login) {
      if (!role.rolcanlogin) await owner.unsafe(`alter role ${role.rolname} nologin`);
    }
    await owner.end({ timeout: 0 });
  }
  if (control) {
    await control.unsafe(`drop database if exists "${database}" with (force)`);
    await control.end({ timeout: 0 });
  }
});
describe("bounded admin transactions on PostgreSQL", () => {
  it("new role sessions receive the migration defaults", async () => {
    expect((await app`show statement_timeout`)[0].statement_timeout).toBe("30s");
    expect((await app`show lock_timeout`)[0].lock_timeout).toBe("5s");
    expect((await app`show idle_in_transaction_session_timeout`)[0].idle_in_transaction_session_timeout).toBe("30s");
    expect((await publicClient`show statement_timeout`)[0].statement_timeout).toBe("10s");
  });
  it("two admin actions coexist while one callback is held open", async () => {
    const entered = gate(), release = gate();
    const first = withAdminAction(["admin"], async () => {
      entered.resolve(); await release.promise; return "first";
    });
    try {
      await entered.promise;
      expect(await Promise.race([
        withAdminAction(["admin"], async () => "second"),
        pause(1500).then(() => "blocked"),
      ])).toBe("second");
    } finally { release.resolve(); await first; }
  });
  it("a role change waits for a shared holder and excludes another ordinary action", async () => {
    const entered = gate(), release = gate(), exclusiveEntered = gate(), exclusiveRelease = gate();
    const first = withAdminAction(["admin"], async () => { entered.resolve(); await release.promise; });
    let exclusive: Promise<unknown> | undefined, ordinary: Promise<unknown> | undefined;
    let roleEntered = false, ordinaryEntered = false;
    try {
      await entered.promise;
      exclusive = withAdminAction(["admin"], async () => {
        roleEntered = true; exclusiveEntered.resolve(); await exclusiveRelease.promise;
      }, "exclusive");
      await until(async () => (await owner`select 1 from pg_locks where locktype='advisory' and objid=73501947 and not granted`).length > 0);
      expect(roleEntered).toBe(false);
      release.resolve(); await first; await exclusiveEntered.promise;
      ordinary = withAdminAction(["admin"], async () => { ordinaryEntered = true; });
      await until(async () => (await owner`select 1 from pg_locks where locktype='advisory' and objid=73501947 and not granted`).length > 0);
      expect(ordinaryEntered).toBe(false);
    } finally {
      release.resolve(); exclusiveRelease.resolve();
      await Promise.all([first, exclusive, ordinary]);
    }
  });
  it("the real role-change action chooses the exclusive lock and reports lock timeout safely", async () => {
    const entered = gate(), release = gate();
    const holder = withAdminAction(["admin"], async () => { entered.resolve(); await release.promise; });
    try {
      await entered.promise;
      const start = Date.now();
      const result = await changeRole(boundary.id, "editor", "must not change while shared lock held");
      expect(result).toEqual({ ok: false, error: "The request failed. Reload the record and try again.", status: 503 });
      expect(Date.now() - start).toBeGreaterThanOrEqual(4500);
      expect(Date.now() - start).toBeLessThan(15000);
      expect((await owner`select role from app.users where id=${boundary.id}`)[0].role).toBe("admin");
    } finally { release.resolve(); await holder; }
  });
  it("ordinary actions fail on a held exclusive lock within lock_timeout and recover", async () => {
    const entered = gate(), release = gate();
    const holder = owner.begin(async tx => {
      await tx`select pg_advisory_xact_lock(73501947)`;
      entered.resolve(); await release.promise;
    });
    try {
      await entered.promise;
      const start = Date.now();
      await expect(withAdminAction(["admin"], async () => "not reached")).rejects.toMatchObject({ cause: { code: "55P03" } });
      expect(Date.now() - start).toBeGreaterThanOrEqual(4500);
      expect(Date.now() - start).toBeLessThan(15000);
    } finally { release.resolve(); await holder; }
    expect(await withAdminAction(["admin"], async () => "recovered")).toBe("recovered");
  });
  it("rechecks the actor role inside the transaction", async () => {
    await owner`update app.users set role='user' where id=${boundary.id}`;
    try {
      await expect(withAdminAction(["admin"], async () => "not reached")).rejects.toMatchObject({ code: "role_required" });
    } finally { await owner`update app.users set role='admin' where id=${boundary.id}`; }
  });
  it("an idle transaction is terminated and its advisory lock released", async () => {
    const connection = await app.reserve();
    try {
      await connection`begin`;
      // Defaults asserted above. Shorten only this disposable transaction for a fast test.
      await connection`set local idle_in_transaction_session_timeout = '250ms'`;
      const [{ pid }] = await connection`select pg_backend_pid() pid`;
      await connection`select pg_advisory_xact_lock(73501947)`;
      await until(async () => (await owner`select 1 from pg_stat_activity where pid=${pid}`).length === 0);
      const [row] = await owner`select pg_try_advisory_xact_lock(73501947) available`;
      expect(row.available).toBe(true);
    } finally { connection.release(); }
  });
  it("user actions use the shared lock", async () => {
    // Consent must be current for the real user-action recheck.
    const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import("../src/lib/auth/policies");
    await owner`update app.users set terms_version=${CURRENT_TERMS_VERSION},privacy_version=${CURRENT_PRIVACY_VERSION} where id=${boundary.id}`;
    await owner.begin(async tx => {
      await tx`select pg_advisory_xact_lock_shared(73501947)`;
      expect(await withUserAction(async () => "coexists")).toBe("coexists");
    });
  });
});
