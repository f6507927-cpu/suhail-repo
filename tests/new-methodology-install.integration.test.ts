import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import * as schema from "../src/db/schema";
import type { Tx } from "../src/lib/auth/audit";
import { installNewMethodology, documentReference } from "../src/lib/methodology/install-new";
import { newMethodologyDefinition } from "../src/lib/methodology/new-methodologies";

// D-171/D-172: founder-run installers on a dedicated disposable PostgreSQL 17 database.
let connection: Sql, root: Sql;
const databaseName = `new_methodology_${randomUUID().replaceAll("-", "")}`;
const email = "methodology-installer@example.invalid";
beforeAll(async () => {
  root = cliConnection("DATABASE_URL_TEST");
  await root.unsafe(`create database "${databaseName}"`);
  const url = new URL(testDatabaseUrl()); url.pathname = `/${databaseName}`;
  vi.stubEnv("DATABASE_URL_TEST", url.toString());
  connection = cliConnection("DATABASE_URL_TEST");
  vi.unstubAllEnvs();
  await applyMigrations(connection); await seedDatabase(connection);
  await connection`insert into app.users(id,email,full_name,role) values(${randomUUID()},${email},'Fixture founder','admin')`;
}, 60_000);
afterAll(async () => {
  await connection?.end();
  if (root) { await root.unsafe(`drop database if exists "${databaseName}"`); await root.end(); }
});
const rollback = new Error("isolated installer fixture");
async function isolated(work: (tx: Tx) => Promise<void>) {
  try { await drizzle(connection, { schema }).transaction(async tx => {
    await tx.execute(sql`set local role suhail_app`); await work(tx); throw rollback;
  }); } catch (e) { if (e !== rollback) throw e; }
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

describe.each(["aaoifi", "msci"] as const)("%s installer", key => {
  const definition = newMethodologyDefinition(key);
  it("dry run is read-only and prints exactly what will be recorded", async () => isolated(async tx => {
    const before = await snapshot(tx);
    const result = await tx.transaction(async sub => {
      const value = await installNewMethodology(sub, key, email, true, "2026-11-07");
      expect((await sub.execute(sql`show transaction_read_only`))[0]).toMatchObject({ transaction_read_only: "on" });
      return value;
    });
    expect(result).toMatchObject({ dryRun: true, plan: { methodology: "create non-demo, production-disabled" },
      record: { methodology: { verified_by: "Fixture founder", verification_date: "2026-11-07", production_enabled: false },
        sourceDocument: { confidence_tier: "Verified", document_reference: documentReference(definition.document), is_synthetic: false },
        analystCases: { coveragePassed: true } } });
    if (key === "msci") expect(result).toHaveProperty("operatingLeaseImpact.statusChangesIfOperatingLeasesIncluded");
    else expect(result).not.toHaveProperty("operatingLeaseImpact");
    expect(await snapshot(tx)).toBe(before);
  }));
  it("installs an audited unpublished draft once, then reruns as a no-op", async () => isolated(async tx => {
    const settings = await tx.select().from(schema.editorialSetting);
    const result = await installNewMethodology(tx, key, email, false, "2026-11-07");
    const [m] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, definition.metadata.slug));
    expect(m).toMatchObject({ is_demo: false, production_enabled: false, production_blocked: false,
      verified_by: "Fixture founder", verification_date: "2026-11-07", licensing_status: "unlicensed_adapted" });
    const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_id, m.id));
    expect(v).toMatchObject({ workflow_status: "draft", is_public: false, production_enabled: false, approved_by: null });
    expect(v.analyst_test_cases.length).toBeGreaterThan(10);
    expect(result.dryRun).toBe(false);
    const [doc] = await tx.select().from(schema.source).where(eq(schema.source.id, (result as { sourceId: string }).sourceId));
    expect(doc).toMatchObject({ confidence_tier: "Verified", source_type: "methodology_document", is_demo: false,
      is_synthetic: false, source_url: definition.document.url, document_reference: documentReference(definition.document) });
    expect(v.source_ids).toEqual([doc.id]);
    const criteria = await tx.select().from(schema.methodologyCriterion).where(eq(schema.methodologyCriterion.methodology_version_id, v.id));
    expect(criteria).toHaveLength(definition.criteria.length);
    // Never changes the editorial default (Al Rajhi stays the site default).
    expect(await tx.select().from(schema.editorialSetting)).toEqual(settings);
    const first = await snapshot(tx);
    // A rerun on a later date preserves the recorded verification and writes nothing.
    expect(await installNewMethodology(tx, key, email, false, "2026-12-01")).toMatchObject({
      plan: { methodology: "unchanged", version: "unchanged draft", analystCases: "unchanged" } });
    expect(await snapshot(tx)).toBe(first);
  }));
  it("refuses a conflicting existing record without writing", async () => isolated(async tx => {
    await installNewMethodology(tx, key, email, false, "2026-11-07");
    await tx.update(schema.methodology).set({ name: "Tampered name" }).where(eq(schema.methodology.slug, definition.metadata.slug));
    const before = await snapshot(tx);
    await expect(installNewMethodology(tx, key, email, false, "2026-11-07")).rejects.toThrow("conflicts");
    expect(await snapshot(tx)).toBe(before);
  }));
  it("refuses a non-admin actor", async () => isolated(async tx => {
    await expect(installNewMethodology(tx, key, "nobody@example.invalid", true, "2026-11-07")).rejects.toThrow("admin actor");
  }));
});
