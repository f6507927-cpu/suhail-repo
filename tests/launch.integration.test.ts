import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, symlink, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql as query } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import * as schema from "../src/db/schema";
import type { Tx, AppUser } from "../src/lib/auth/audit";
import { launchPreflight, prepareLaunchDraft } from "../src/lib/launch/draft";
import { launchDefinition, launchInputs, launchCases } from "../src/lib/launch/contracts";
import { applyLaunchEvidence, launchTickerReport } from "../src/lib/launch/evidence";
import { candidateDefinition, transition } from "../src/lib/methodology/service";
import { testReport } from "../src/lib/methodology/reports";
import { addSecurity, mutateFinancial } from "../src/lib/financial/service";
import { persistAnnual } from "../src/lib/financial/persistence";
import { mapAnnual } from "../src/ingest/sec/annual";
import { refreshMarketValue } from "../src/lib/financial/market-value-persistence";
import { screen, ENGINE_VERSION, CALCULATION_VERSION } from "../src/engine";
import type { Fixture } from "../src/ingest/sec/types";
import definitionFile from "../data/methodologies/al-rajhi-adapted-1.0.json";
import { runLaunch } from "../src/lib/launch/run";
import type { Mutation } from "../src/ingest/sec/ingest";
vi.mock("server-only", () => ({}));
// Only the trusted runner's connection is injected. Real services, audited writes,
// mapping and role-limited PostgreSQL still execute; runtime guards are unchanged.
let activeTransaction: Tx | undefined;
vi.mock("../src/db/app", () => ({
  dbApp: {
    transaction: async (work: (tx: Tx) => Promise<unknown>) => {
      if (!activeTransaction) throw new Error("Missing isolated runner transaction");
      const tx = activeTransaction;
      return work(new Proxy(tx, {
        get(target, property) {
          if (property === "execute") return (statement: Parameters<Tx["execute"]>[0]) => {
            // The enclosing test transaction is deliberately rollback-only.
            // Actual CLI read-only transactions are checked separately above.
            const rendered = new PgDialect().sqlToQuery(statement as import("drizzle-orm").SQL).sql;
            return rendered === "set transaction read only" ? Promise.resolve([]) : target.execute(statement);
          };
          const value = Reflect.get(target, property);
          return typeof value === "function" ? value.bind(target) : value;
        },
      }));
    },
  },
}));
import { PgDialect } from "drizzle-orm/pg-core";

let client: Sql;
let actor: AppUser;
let defaults: { id: string; value: string | null }[];
const rollback = new Error("isolated launch rollback");
const email = "launch-fixture@example.test";
const definition = launchDefinition(definitionFile);
const universe = readFileSync("data/launch/universe.csv", "utf8");
const filled = readFileSync("tests/fixtures/launch/inputs-filled.csv", "utf8");
const row = launchInputs(filled, universe)[0];
const fixture = JSON.parse(readFileSync("tests/fixtures/sec/aapl.json", "utf8")) as Fixture;
const exec = promisify(execFile);
async function counts(tx: Tx) {
  return Array.from(await tx.execute(query`
    select 'audit' as name, count(*)::int as n from app.audit_event union all
    select 'methodology', count(*)::int from app.methodology union all
    select 'versions', count(*)::int from app.methodology_version union all
    select 'criteria', count(*)::int from app.methodology_criterion union all
    select 'reports', count(*)::int from app.methodology_version_report union all
    select 'sources', count(*)::int from app.source union all
    select 'facts', count(*)::int from app.financial_fact union all
    select 'periods', count(*)::int from app.financial_period union all
    select 'segments', count(*)::int from app.business_segment union all
    select 'prices', count(*)::int from app.price_bar union all
    select 'securities', count(*)::int from app.security
  `));
}
beforeAll(async () => {
  client = cliConnection("DATABASE_URL_TEST");
  await applyMigrations(client);
  await seedDatabase(client);
  // Disposable plain PostgreSQL roles start NOLOGIN; the real workspace CLI
  // verifies its directly connected role rather than accepting SET ROLE.
  await client`alter role suhail_app login`;
  const db = drizzle(client, { schema });
  [actor] = await db.insert(schema.users).values({ id: randomUUID(), full_name: "Local launch fixture", email, role: "admin" }).returning();
  const settings = await db.select().from(schema.editorialSetting);
  defaults = settings.map(s => ({ id: s.id, value: s.default_shariah_methodology_version_id }));
  await db.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: null });
});
afterAll(async () => {
  if (client) {
    const db = drizzle(client, { schema });
    for (const setting of defaults ?? [])
      await db.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: setting.value }).where(eq(schema.editorialSetting.id, setting.id));
    if (actor) await db.delete(schema.users).where(eq(schema.users.id, actor.id));
    await client`alter role suhail_app nologin`;
    await client.end();
  }
});
async function isolated(work: (tx: Tx) => Promise<void>) {
  try {
    await drizzle(client, { schema }).transaction(async tx => {
      await tx.execute(query`set local role suhail_app`);
      await work(tx);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}

describe("launch workspace services on disposable PostgreSQL only", () => {
  it("preflight writes nothing; actual pnpm valid dry-run writes no rows or local files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "suhail-launch-cli-"));
    try {
      await mkdir(join(dir, "data/launch"), { recursive: true });
      await mkdir(join(dir, "data/methodologies"), { recursive: true });
      await writeFile(join(dir, "data/launch/inputs.csv"), filled);
      await writeFile(join(dir, "data/launch/universe.csv"), universe);
      await writeFile(join(dir, "data/methodologies/al-rajhi-adapted-1.0.json"), JSON.stringify(definitionFile));
      for (const folder of ["scripts", "node_modules", "src"]) await symlink(resolve(folder), join(dir, folder));
      await writeFile(join(dir, "package.json"), JSON.stringify({ scripts: { "setup:launch": "node scripts/run-launch.mjs" } }));
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (/DATABASE_URL|^PG|SUPABASE|SESSION_SECRET/.test(key)) delete env[key];
      env.DATABASE_URL_APP = "postgresql://suhail_app@127.0.0.1:55432/suhail_test";
      const db = drizzle(client, { schema });
      const before = await counts(db as unknown as Tx);
      // Snapshot fixture-owned files, not the entire repository through symlinks.
      const files = async () => ({ root: await readdir(dir), data: await readdir(join(dir, "data"), { recursive: true }) });
      const beforeFiles = await files();
      const { stdout } = await exec("pnpm", ["setup:launch", "--", "--actor", email, "--dry-run"], { cwd: dir, env });
      expect(stdout).toContain('"dryRun": true');
      expect(stdout).toContain('"ticker": "JPM"');
      expect(stdout).toContain("no report/workflow advancement");
      expect(await counts(db as unknown as Tx)).toEqual(before);
      expect(await files()).toEqual(beforeFiles);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30000);
  it("preflight stops on either example default, non-admin, conflicting metadata, finalized content", () => isolated(async tx => {
    const before = await counts(tx);
    for (const slug of ["example-a", "example-b"]) {
      const [m] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, slug));
      const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_id, m.id));
      await tx.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: v.id });
      await expect(launchPreflight(tx, email, definition)).rejects.toThrow(/editorial default/);
    }
    await tx.update(schema.editorialSetting).set({ default_shariah_methodology_version_id: null });
    await expect(launchPreflight(tx, "absent@example.test", definition)).rejects.toThrow(/admin actor/);
    expect(await counts(tx)).toEqual(before);
    await prepareLaunchDraft(tx, email, definition);
    const [m] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, definition.metadata.slug));
    const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_id, m.id));
    await tx.update(schema.methodology).set({ name: "Conflicting content" }).where(eq(schema.methodology.id, m.id));
    await expect(launchPreflight(tx, email, definition)).rejects.toThrow(/conflicts/);
    await tx.update(schema.methodology).set({ name: definition.metadata.name }).where(eq(schema.methodology.id, m.id));
    await tx.update(schema.methodologyVersion).set({ workflow_status: "source_verified" }).where(eq(schema.methodologyVersion.id, v.id));
    await expect(launchPreflight(tx, email, definition)).rejects.toThrow(/left draft/);
  }));
  it("creates only draft content with real criterion identities, attributes audits, unchanged repeat adds nothing", () => isolated(async tx => {
    const before = await counts(tx);
    await launchPreflight(tx, email, definition);
    expect(await counts(tx)).toEqual(before);
    await prepareLaunchDraft(tx, email, definition);
    const firstCounts = await counts(tx);
    await prepareLaunchDraft(tx, email, definition);
    expect(await counts(tx)).toEqual(firstCounts);
    const [m] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, definition.metadata.slug));
    const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_id, m.id));
    expect(m).toMatchObject({ is_demo: false, production_enabled: false, verified_by: null, verification_date: null });
    expect(v).toMatchObject({ workflow_status: "draft", is_public: false, production_enabled: false, approved_by: null, approval_id: null, workflow_history: [] });
    expect(v.source_ids).toHaveLength(1);
    const [document] = await tx.select().from(schema.source).where(eq(schema.source.id, v.source_ids[0]));
    expect(document).toMatchObject({
      source_type: "methodology_document", provider: "Al Rajhi Capital (public document)",
      document_title: "الضوابط الشرعية لمنتجات شركة الراجحي المالية (آلية احتساب العنصر المحرم)",
      source_url: m.source_url, confidence_tier: "Verified",
      is_demo: false, is_synthetic: false, production_blocked: false, created_by: actor.id,
    });
    expect(document.retrieved_at).toBeInstanceOf(Date);
    const candidate = await candidateDefinition(tx, v.id);
    const identities = Object.fromEntries(definition.criteria.map(c => [c.key, candidate.criteria.find(r => r.sortOrder === c.data.sort_order)!.id]));
    expect(testReport(candidate, launchCases(definition, identities)).passed).toBe(true);
    const audit = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.actor_id, actor.id));
    expect(audit.length).toBeGreaterThan(5);
    expect(audit.every(a => a.actor_email === email && a.actor_role === "admin")).toBe(true);
    expect(audit.some(a => a.entity_name === "source" && a.entity_id === document.id)).toBe(true);
    const examples = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.is_demo, true));
    expect(examples.filter(v => v.methodology_name?.startsWith("Example Methodology")).every(v => !v.is_public)).toBe(true);
    // The CLI does not invent human verification metadata or advance the workflow.
    // Once an analyst supplies that metadata, its associated document passes the real gate.
    await tx.update(schema.methodology).set({ verified_by: actor.full_name, verification_date: "2026-10-23" })
      .where(eq(schema.methodology.id, m.id));
    const verifiedCounts = await counts(tx);
    await prepareLaunchDraft(tx, email, definition);
    expect(await counts(tx)).toEqual(verifiedCounts);
    const [preserved] = await tx.select().from(schema.methodology).where(eq(schema.methodology.id, m.id));
    expect(preserved).toMatchObject({ verified_by: actor.full_name, verification_date: "2026-10-23" });
    await transition(tx, actor, v.id, "source_verified", "Disposable fixture verification");
    const [verified] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id, v.id));
    expect(verified.workflow_status).toBe("source_verified");
  }));
  it("reuses an existing eligible document and refuses tainted evidence without relabelling it", () => isolated(async tx => {
    const [document] = await tx.insert(schema.source).values({
      label: "Existing Al Rajhi document", source_type: "methodology_document",
      provider: "Al Rajhi Capital (public document)", document_title: definition.metadata.source_title,
      source_url: definition.metadata.source_url, confidence_tier: "Verified",
      is_demo: false, is_synthetic: false, production_blocked: false, retrieved_at: new Date(),
    }).returning();
    const before = await counts(tx);
    await launchPreflight(tx, email, definition);
    expect(await counts(tx)).toEqual(before);
    await prepareLaunchDraft(tx, email, definition);
    const [m] = await tx.select().from(schema.methodology).where(eq(schema.methodology.slug, definition.metadata.slug));
    const [v] = await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.methodology_id, m.id));
    expect(v.source_ids).toEqual([document.id]);
    const after = await counts(tx);
    expect(after.find(c => c.name === "sources")).toEqual(before.find(c => c.name === "sources"));
    await prepareLaunchDraft(tx, email, definition);
    expect(await counts(tx)).toEqual(after);
    await tx.update(schema.source).set({ confidence_tier: "Estimated" }).where(eq(schema.source.id, document.id));
    await expect(prepareLaunchDraft(tx, email, definition)).rejects.toThrow(/not genuine verified/);
    expect(await counts(tx)).toEqual(after);
  }));
  it("loads sourced prices/whole-company segment and preserves blank income; repeats and reversals remain governed", () => isolated(async tx => {
    const id = await addSecurity(tx, actor, { cik: "0000320193", ticker: "AAPL", name: "Local launch issuer", exchange: "NASDAQ", sector: "", fiscalYearEnd: "0930" });
    const [s] = await tx.select().from(schema.security).where(eq(schema.security.id, id));
    await persistAnnual(tx, actor, s.company_id!, mapAnnual(fixture.companyfacts, fixture.metadata));
    await applyLaunchEvidence(tx, actor, id, row);
    const first = await counts(tx);
    await addSecurity(tx, actor, { cik: "0000320193", ticker: "AAPL", name: "Local launch issuer", exchange: "NASDAQ", sector: "", fiscalYearEnd: "0930" });
    await persistAnnual(tx, actor, s.company_id!, mapAnnual(fixture.companyfacts, fixture.metadata));
    await applyLaunchEvidence(tx, actor, id, row);
    expect(await counts(tx)).toEqual(first);
    const report = await launchTickerReport(tx, id, row, "2026-10-19");
    expect(report).toMatchObject({ ticker: "AAPL", selectedQuarter: "2026 Q3", stale: false, activity_category: "technology", prohibited_income: { supplied: false, state: "unknown" } });
    expect(report.closes.map(c => c.close)).toEqual([10, 20, 30]);
    expect(report.market_value_basis).toBeGreaterThan(0);
    const [segment] = await tx.select().from(schema.businessSegment).where(eq(schema.businessSegment.company_id, s.company_id!));
    expect(segment.revenue_share).toBe(1);
    const sources = await tx.select().from(schema.source).where(eq(schema.source.provider, "Manual entry"));
    expect(sources).toHaveLength(3);
    expect(sources.every(s => s.source_type === "market_data" && s.label === row.price_source_label && s.source_url === row.price_source_url)).toBe(true);
    const corrected = { ...row, prohibited_income: "10", prohibited_income_source: "Founder sourced annual note", prohibited_income_note: "Same annual period reviewed gross amount" };
    await applyLaunchEvidence(tx, actor, id, corrected);
    await applyLaunchEvidence(tx, actor, id, { ...corrected, prohibited_income: "13" });
    await applyLaunchEvidence(tx, actor, id, corrected);
    const correctedCounts = await counts(tx);
    await applyLaunchEvidence(tx, actor, id, corrected);
    expect(await counts(tx)).toEqual(correctedCounts);
    expect((await launchTickerReport(tx, id, corrected, "2026-10-19")).prohibited_income).toMatchObject({ value: 10, state: "reported" });
    const annual = mapAnnual(fixture.companyfacts, fixture.metadata);
    const shares = annual.facts.find(f => f.line_item === "shares_outstanding")!;
    shares.shares_class_concern = true; shares.mapping_note += "; explicitly aggregated test evidence";
    await persistAnnual(tx, actor, s.company_id!, annual);
    expect((await launchTickerReport(tx, id, row, "2026-10-19")).market_value_basis).toBeNull();
    expect((await launchTickerReport(tx, id, row, "2026-10-19")).shareClassConcern).toHaveLength(1);
    const [currentShares] = await tx.select().from(schema.financialFact).where(query`company_id = ${s.company_id} and line_item = 'shares_outstanding' and is_current`);
    await mutateFinancial(tx, actor, { operation: "override", securityId: id, data: {
      factId: currentShares.id, value: "10", input_state: "reported", confidence_tier: "Verified",
      reason: "Must not bypass latest explicit cover evidence", source: { label: "Local shares correction", source_type: "internal" },
    } });
    const basis = await refreshMarketValue(tx, actor, s.company_id!, id, "2027-01-01");
    expect(basis?.value).toBeNull();
    // A newer cover page supersedes the historical plurality; reputation and the
    // protected override's old flag must not perpetuate an obsolete concern.
    const single = structuredClone(annual);
    const latest = single.facts.find(f => f.line_item === "shares_outstanding")!;
    latest.shares_class_concern = false;
    latest.as_of_date = "2026-10-21";
    latest.mapping_note = "A single dei cover-page value on a newer filing";
    await persistAnnual(tx, actor, s.company_id!, single);
    const newerReport = await launchTickerReport(tx, id, row, "2026-10-21");
    expect(newerReport.shareClassConcern).toEqual([]);
    expect(newerReport.market_value_basis).not.toBeNull();
  }));
  it("fallback denominator lowers screening confidence/adequacy and retains its quarter provenance", () => isolated(async tx => {
    const id = await addSecurity(tx, actor, { cik: "0000320193", ticker: "AAPL", name: "Local launch issuer", exchange: "NASDAQ", sector: "", fiscalYearEnd: "0930" });
    const [s] = await tx.select().from(schema.security).where(eq(schema.security.id, id));
    await persistAnnual(tx, actor, s.company_id!, mapAnnual(fixture.companyfacts, fixture.metadata));
    await applyLaunchEvidence(tx, actor, id, row);
    const basis = await refreshMarketValue(tx, actor, s.company_id!, id, "2027-01-01");
    expect(basis).toMatchObject({ input_state: "estimated", confidence_tier: "Estimated", calculation_version: "calc-2026.10.5" });
    expect(JSON.parse(basis!.mapping_note!).freshnessNote).toBe("prices from 2026 Q3");
    const identities = { primary_activity: randomUUID(), debt: randomUUID(), income: randomUUID() };
    const sample = launchCases(definition, identities)[0];
    const result = screen({ ...sample.inputs, asOf: "2027-01-01", engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION,
      facts: sample.inputs.facts.map(f => f.lineItem === "market_value_basis" ? { ...f, inputState: basis!.input_state === "missing" ? "unknown" : basis!.input_state, confidenceTier: basis!.confidence_tier } : f),
      methodologyVersion: { id: randomUUID(), label: "Candidate", criteria: definition.criteria.map(c => ({
        ...candidateCriterion({ ...c.data, id: identities[c.key] }),
      })) } });
    expect(result).toMatchObject({ confidence: "Medium", dataAdequacy: "adequate_with_estimates" });
  }));
  it("runs every ticker serially with fixture SEC responses, continues failures, reports gaps and no-ops successful repeats", () => isolated(async tx => {
    activeTransaction = tx;
    try {
      let inFlight = 0, maximum = 0;
      const rows = launchInputs(filled, universe);
      const reports: unknown[] = [];
      const dependencies = {
        lookup: async (ticker: string) => {
          if (ticker === "NVDA") throw new Error("Private transport details must not escape");
          const index = rows.findIndex(r => r.ticker === ticker);
          return { ticker, cik: String(9000000 + index).padStart(10, "0"), name: `Launch fixture ${ticker}`,
            exchange: "NASDAQ" as const, sector: "", fiscalYearEnd: "0930" };
        },
        ingest: async (id: string, mutate: Mutation) => {
          inFlight++; maximum = Math.max(maximum, inFlight);
          try {
            return await mutate(async (current, who) => {
              const [s] = await current.select().from(schema.security).where(eq(schema.security.id, id));
              if (s.ticker === "ADBE") throw new Error("Fixture ingest failure");
              const copy = structuredClone(fixture);
              copy.companyfacts.cik = 9000000 + rows.findIndex(r => r.ticker === s.ticker);
              copy.metadata.is_synthetic = true;
              return persistAnnual(current, who, s.company_id!, mapAnnual(copy.companyfacts, copy.metadata));
            });
          } finally { inFlight--; }
        },
      };
      const options = { email, dryRun: true, definition, rows, asOf: new Date().toISOString().slice(0, 10) };
      const before = await counts(tx);
      await runLaunch(options, r => reports.push(r), dependencies);
      expect(await counts(tx)).toEqual(before);
      expect(maximum).toBe(0);
      reports.length = 0;
      await runLaunch({ ...options, dryRun: false }, r => reports.push(r), dependencies);
      expect(maximum).toBe(1);
      const tickers = reports.slice(1) as Record<string, unknown>[];
      expect(tickers.map(r => r.ticker)).toEqual(rows.map(r => r.ticker));
      expect(tickers.filter(r => r.error)).toHaveLength(2);
      expect(tickers.every(r => Array.isArray(r.missing))).toBe(true);
      expect(tickers.at(-1)).toMatchObject({ ticker: "JPM", ingestOutcome: "ingested", activity_category: "conventional_finance" });
      expect(JSON.stringify(reports)).not.toContain("Private transport");
      const first = await counts(tx);
      await runLaunch({ ...options, dryRun: false }, () => {}, dependencies);
      expect(await counts(tx)).toEqual(first);
    } finally { activeTransaction = undefined; }
  }));
});
import { engineCriterion as candidateCriterion } from "../src/lib/methodology/contracts";
