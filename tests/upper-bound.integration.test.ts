import { beforeAll, afterAll, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql, and } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import { testDatabaseUrl } from "../scripts/db/test-target";
import * as schema from "../src/db/schema";
import type { Tx } from "../src/lib/auth/audit";
import base from "../data/methodologies/al-rajhi-adapted-1.0.json";
import { installV11 } from "../src/lib/methodology/install-v11";
import { saveMethodology, saveVersion, associateSource, transition, candidateDefinition } from "../src/lib/methodology/service";
import { addSecurity } from "../src/lib/financial/service";
import { persistAnnual } from "../src/lib/financial/persistence";
import { screenSecurity } from "../src/screening/service";
import { storedBoundInputs } from "../src/lib/financial/screening-facts";
import { storedBalanceFacts } from "../src/ingest/sec/fsn/stored-bound";
import { unavailableBalanceSheet } from "../src/ingest/sec/fsn/balance-sheet";
import { fsnTargets } from "./fsn-fixture";

let connection: Sql;
let root: Sql;
let originalLogin = false;
const databaseName = `bound_fixture_${randomUUID().replaceAll("-", "")}`;
async function cli(dryRun: boolean) {
  const url = new URL(testDatabaseUrl()); url.pathname = `/${databaseName}`; url.username = "suhail_app";
  const result = await promisify(execFile)(process.execPath, [
    "--conditions=react-server", "--import", "tsx", "scripts/methodology/install-v11.ts",
    "--actor", "v11-fixture@example.invalid", ...(dryRun ? ["--dry-run"] : []),
  ], { env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test",
    DATABASE_URL_APP: url.toString() }, timeout: 20000 });
  return JSON.parse(result.stdout);
}
beforeAll(async () => {
  // Dedicated disposable loopback DB: committed read-only-test prerequisites never
  // leak into other suites, and append-only audit rows need no DELETE bypass.
  root = cliConnection("DATABASE_URL_TEST");
  const roles = await root`select rolcanlogin from pg_roles where rolname = 'suhail_app'`;
  originalLogin = roles[0]?.rolcanlogin ?? false;
  await root.unsafe(`create database "${databaseName}"`);
  const url = new URL(testDatabaseUrl()); url.pathname = `/${databaseName}`;
  vi.stubEnv("DATABASE_URL_TEST", url.toString());
  connection = cliConnection("DATABASE_URL_TEST");
  vi.unstubAllEnvs();
  await applyMigrations(connection); await seedDatabase(connection);
  // Native CLI must authenticate as the real runtime role, not bypass its guard.
  // This cluster is disposable/loopback; restore its normal NOLOGIN fixture role.
  await root`alter role suhail_app login`;
});
afterAll(async () => {
  await connection?.end();
  if (root) {
    await root.unsafe(`drop database if exists "${databaseName}"`);
    if (!originalLogin) await root`alter role suhail_app nologin`;
    await root.end();
  }
});
const rollback = new Error("isolated upper-bound fixture");
async function isolated(work: (tx: Tx) => Promise<void>) {
  try { await drizzle(connection, { schema }).transaction(async tx => {
    await tx.execute(sql`set local role suhail_app`);
    await work(tx); throw rollback;
  }); }
  catch (e) { if (e !== rollback) throw e; }
}
async function setup(tx: Tx) {
  const [actor] = await tx.insert(schema.users).values({
    id: randomUUID(), email: "v11-fixture@example.invalid", full_name: "Fixture admin", role: "admin",
  }).returning();
  const parent = await saveMethodology(tx, actor, null, base.metadata);
  await tx.update(schema.methodology).set({ verified_by: "Fixture verifier", verification_date: "2026-10-30" })
    .where(eq(schema.methodology.id, parent));
  const version = await saveVersion(tx, actor, parent, null, null, base.version);
  const [doc] = await tx.insert(schema.source).values({
    label: "Synthetic methodology document", source_type: "methodology_document",
    provider: "Al Rajhi Capital (public document)", source_url: base.metadata.source_url,
    document_title: base.metadata.source_title, confidence_tier: "Verified",
    is_demo: false, is_synthetic: false, production_blocked: false,
  }).returning();
  await associateSource(tx, actor, version, doc.id);
  return { actor, parent, version, doc };
}
async function snapshot(tx: Tx) {
  return JSON.stringify(await Promise.all([
    tx.select().from(schema.methodology).orderBy(schema.methodology.id),
    tx.select().from(schema.methodologyVersion).orderBy(schema.methodologyVersion.id),
    tx.select().from(schema.methodologyCriterion).orderBy(schema.methodologyCriterion.id),
    tx.select().from(schema.source).orderBy(schema.source.id),
    tx.select().from(schema.auditEvent).orderBy(schema.auditEvent.id),
    tx.select().from(schema.editorialSetting).orderBy(schema.editorialSetting.id),
  ]));
}
it("installer dry-run uses a read-only transaction and changes no rows", async () => {
  // Prerequisites live only in this suite's dedicated disposable database.
  let fixture: Awaited<ReturnType<typeof setup>>;
  await drizzle(connection, { schema }).transaction(async tx => { fixture = await setup(tx); });
    const db = drizzle(connection, { schema });
    const before = await db.transaction(snapshot);
    await db.transaction(async tx => {
      await tx.execute(sql`set local role suhail_app`);
      expect(await installV11(tx, fixture!.actor.email!, true)).toMatchObject({
        action: "create draft", visibility: false, annualYieldAssumption: 0.06,
      });
      const result = await tx.execute(sql`show transaction_read_only`);
      expect(result[0].transaction_read_only).toBe("on");
    });
    expect(await cli(true)).toMatchObject({ dryRun: true, action: "create draft" });
    expect(await db.transaction(snapshot)).toBe(before);
});
it("installer is idempotent, audited, source-gated, and never advances/publishes/defaults", async () => isolated(async tx => {
  // Use the already committed fixture from the read-only test.
  const [actor] = await tx.select().from(schema.users).where(eq(schema.users.email, "v11-fixture@example.invalid"));
  const before = await tx.select().from(schema.editorialSetting);
  const result = await installV11(tx, actor.email!, false);
  expect(result.action).toBe("created draft");
  const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id, result.versionId!));
  expect(v).toMatchObject({ workflow_status: "draft", is_public: false, production_enabled: false, analyst_test_cases: [] });
  const definition = await candidateDefinition(tx, v.id);
  expect(definition.criteria.find(c => !!c.treatmentRuleData.suhail_upper_bound)?.treatmentRuleData.suhail_upper_bound)
    .toMatchObject({ annual_yield_assumption: 0.06 });
  expect((await tx.select().from(schema.auditEvent)).some(a => a.actor_id === actor.id && a.entity_id === v.id)).toBe(true);
  const first = await snapshot(tx);
  expect(await installV11(tx, actor.email!, false)).toMatchObject({ action: "unchanged", versionId: v.id });
  expect(await snapshot(tx)).toBe(first);
  await transition(tx, actor, v.id, "source_verified", "Synthetic source-gate test");
  const advanced = await snapshot(tx);
  expect((await installV11(tx, actor.email!, false)).action).toBe("unchanged");
  expect(await snapshot(tx)).toBe(advanced);
  expect(await tx.select().from(schema.editorialSetting)).toEqual(before);
}));
it("a conflicting existing draft or missing verified document refuses without mutation", async () => isolated(async tx => {
  const [actor] = await tx.select().from(schema.users).where(eq(schema.users.email, "v11-fixture@example.invalid"));
  const [parent] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, base.metadata.slug));
  await saveVersion(tx, actor, parent.id, null, null, { ...base.version, version: "1.1" });
  const before = await snapshot(tx);
  await expect(installV11(tx, actor.email!, false)).rejects.toThrow("conflicts or is incomplete");
  expect(await snapshot(tx)).toBe(before);
  await tx.update(schema.source).set({ confidence_tier: "Estimated" }).where(eq(schema.source.source_url, base.metadata.source_url));
  const changed = await snapshot(tx);
  await expect(installV11(tx, actor.email!, false)).rejects.toThrow("Verified methodology document");
  expect(await snapshot(tx)).toBe(changed);
}));
it("a mid-install database failure rolls back version, criteria and audit rows together", async () => isolated(async tx => {
  await tx.execute(sql`set local role postgres`);
  await tx.execute(sql`create function app.fixture_refuse_v11() returns trigger language plpgsql as $$
    begin raise exception 'fixture criterion refusal'; end $$`);
  await tx.execute(sql`create trigger fixture_refuse_v11 before insert on app.methodology_criterion
    for each row execute function app.fixture_refuse_v11()`);
  await tx.execute(sql`set local role suhail_app`);
  const before = await snapshot(tx);
  await expect(tx.transaction(sub => installV11(sub, "v11-fixture@example.invalid", false))).rejects.toThrow();
  expect(await snapshot(tx)).toBe(before);
}));
it("refresh evidence persists idempotently, screens offline, honors overrides, and invalidates old completeness", async () => isolated(async tx => {
  const [actor] = await tx.select().from(schema.users).where(eq(schema.users.email, "v11-fixture@example.invalid"));
  const installed = await installV11(tx, actor.email!, false);
  const target = structuredClone(fsnTargets[0]);
  target.mapped.period.is_demo = false;
  for (const src of [target.mapped.period.source, ...target.mapped.facts.flatMap(f => f.source ? [f.source] : [])]) {
    src.is_demo = false; src.is_synthetic = false; src.production_blocked = false;
  }
  const sheet = unavailableBalanceSheet(target, "fixture");
  for (const name of ["cash", "short_term", "long_term"] as const) sheet.components[name] = {
    value: name === "cash" ? 100 : 0, state: name === "cash" ? "reported" : "not_on_balance_sheet",
    label: name, reason: null, tags: [], rows: [],
  };
  const id = await addSecurity(tx, actor, { ticker: "AAPL", cik: target.cik, name: "Synthetic issuer",
    exchange: "NASDAQ", sector: "Synthetic", fiscalYearEnd: "0930" });
  const [s] = await tx.select().from(schema.security).where(eq(schema.security.id, id));
  const mapped = { ...target.mapped, facts: [...target.mapped.facts, ...storedBalanceFacts(target, sheet)] };
  const persisted = await persistAnnual(tx, actor, s.company_id!, mapped);
  const first = await tx.select().from(schema.financialFact).where(eq(schema.financialFact.period_id, persisted.periodId));
  await persistAnnual(tx, actor, s.company_id!, mapped);
  expect(await tx.select().from(schema.financialFact).where(eq(schema.financialFact.period_id, persisted.periodId))).toHaveLength(first.length);
  const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Screening must be offline"); });
  try {
    const run = await screenSecurity(id, installed.versionId!, { asOf: "2026-10-31", trigger: "manual" },
      work => work(tx, actor));
    const results = await tx.select().from(schema.screeningCriterionResult).where(eq(schema.screeningCriterionResult.screening_run_id, run.runId));
    expect(results.find(r => r.criterion_type === "custom_ratio")).toMatchObject({ result: "pass", numerator_value: 6, confidence_tier: "Estimated" });
    expect(network).not.toHaveBeenCalled();
    const [income] = await tx.select().from(schema.financialFact).where(and(
      eq(schema.financialFact.period_id, persisted.periodId), eq(schema.financialFact.line_item, "prohibited_income"),
      eq(schema.financialFact.is_current, true)));
    await tx.update(schema.financialFact).set({ protected_current: true }).where(eq(schema.financialFact.id, income.id));
    let current = await tx.select().from(schema.financialFact).where(and(eq(schema.financialFact.period_id, persisted.periodId), eq(schema.financialFact.is_current, true)));
    expect((await storedBoundInputs(tx, current, true)).at(-1)?.value).toBe(0);
    await tx.update(schema.financialFact).set({ protected_current: false }).where(eq(schema.financialFact.id, income.id));
    await persistAnnual(tx, actor, s.company_id!, { ...target.mapped,
      facts: [...target.mapped.facts, ...storedBalanceFacts(target, unavailableBalanceSheet(target, "archive unavailable"))] });
    current = await tx.select().from(schema.financialFact).where(and(eq(schema.financialFact.period_id, persisted.periodId), eq(schema.financialFact.is_current, true)));
    expect((await storedBoundInputs(tx, current, true)).at(-1)?.value).toBe(0);
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
}));
it("the actual workspace CLI writes only its disposable fixture DB and its second run is an exact no-op", async () => {
  const db = drizzle(connection, { schema });
  expect(await cli(false)).toMatchObject({ action: "created draft" });
  const first = await db.transaction(snapshot);
  expect(await cli(false)).toMatchObject({ action: "unchanged" });
  expect(await db.transaction(snapshot)).toBe(first);
});
