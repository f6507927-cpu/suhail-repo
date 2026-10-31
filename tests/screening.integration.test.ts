import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, sql as query } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import * as schema from "../src/db/schema";
import { company, security, exchange, financialPeriod, financialFact, businessSegment, source, priceBar } from "../src/db/schema/market";
import { methodology, methodologyVersion, methodologyCriterion } from "../src/db/schema/methodology";
import { editorialSetting } from "../src/db/schema/editorial";
import { screeningRun, screeningCriterionResult, screeningUnknown } from "../src/db/schema/screening";
import { auditEvent, jobRun } from "../src/db/schema/accounts";
import { screenSecurity } from "../src/screening/service";
import { verifyRun } from "../src/screening/verify";
import { hash } from "../src/engine/canonical";
import { insertCurrent } from "../src/lib/financial/persistence";
import type { Mutation } from "../src/ingest/sec/ingest";
import type { Tx } from "../src/lib/auth/audit";
// eslint-disable-next-line no-restricted-imports -- Local cursor/resume integration with an injected transaction, never a web auth bypass.
import { runScreenBatch, screenUniverse } from "../src/jobs/screen-universe";
vi.mock("server-only", () => ({}));
vi.mock("../src/env/jobs-env", () => ({ getJobsEnv: () => ({ JOB_BATCH_SIZE: 1 }) }));
let connection: Sql;
const rollback = new Error("rollback isolated screening fixture");
beforeAll(async () => {
  connection = cliConnection("DATABASE_URL_TEST");
  await applyMigrations(connection);
});
afterAll(async () => { await connection?.end(); });
async function isolated(work: (tx: Tx) => Promise<void>) {
  try {
    await drizzle(connection, { schema }).transaction(async tx => {
      await tx.execute(query`set local role suhail_app`);
      await work(tx);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
const options = { asOf: "2026-10-16", trigger: "integration-test" };
async function setup(tx: Tx) {
  const unique = randomUUID();
  const [e] = await tx.insert(exchange).values({ code: `S8-${unique}`, name: "Synthetic exchange", is_demo: true }).returning();
  const [c] = await tx.insert(company).values({ name: "Synthetic screening issuer", is_demo: true }).returning();
  const [s] = await tx.insert(security).values({ ticker: "SYNTH", slug: `s8-${unique}`, exchange_id: e.id, company_id: c.id, in_universe: true, is_demo: true }).returning();
  const [p] = await tx.insert(financialPeriod).values({ company_id: c.id, fiscal_period_label: "Synthetic FY2026",
    period_end: "2026-09-30", is_latest: true, is_demo: true }).returning();
  const [src] = await tx.insert(source).values({ label: "Synthetic test evidence", source_type: "internal",
    is_demo: true, is_synthetic: true, source_url: "https://example.test/synthetic" }).returning();
  const [m] = await tx.insert(methodology).values({ name: "Synthetic example methodology", slug: `s8-${unique}`, is_demo: true }).returning();
  const [v] = await tx.insert(methodologyVersion).values({ methodology_id: m.id, version: "1",
    version_label: "Synthetic v1", effective_date: "2026-01-01", is_demo: true }).returning();
  const [debt, business] = await tx.insert(methodologyCriterion).values([
    { methodology_version_id: v.id, criterion_type: "interest_bearing_debt" as const, label: "Synthetic debt",
      numerator_line_items: ["interest_bearing_debt"], denominator_line_items: ["total_assets"], threshold: 33, is_demo: true },
    { methodology_version_id: v.id, criterion_type: "business_activity" as const, label: "Synthetic activity",
      treatment_rule_data: { prohibited_categories: ["alcohol"] }, threshold_unit: "boolean" as const,
      threshold_direction: "boolean" as const, sort_order: 1, is_demo: true },
  ]).returning();
  await tx.insert(financialFact).values([
    { company_id: c.id, period_id: p.id, line_item: "total_assets", value: 1000, source_id: src.id, is_current: true, is_demo: true },
    { company_id: c.id, period_id: p.id, line_item: "interest_bearing_debt", value: 10, source_id: src.id, is_current: true, is_demo: true },
    { company_id: c.id, period_id: p.id, line_item: "shares_outstanding", value: 100, source_id: src.id, is_current: true, is_demo: true },
    { company_id: c.id, period_id: p.id, line_item: "market_cap", value: 900, source_id: src.id, is_current: true, is_demo: true },
  ]);
  await tx.insert(businessSegment).values({ company_id: c.id, period_id: p.id, segment_name: "Synthetic permissible segment",
    activity_category: "technology", revenue_share: 1, revenue_amount: 1000, source_id: src.id, is_demo: true });
  const mutate: Mutation = work => work(tx, null);
  return { s, c, p, src, m, v, debt, business, mutate };
}
describe("database-backed screening", () => {
  it("screens both adapted formulas with derived evidence, estimates, rollover and immutable replay", () => isolated(async tx => {
    const f = await setup(tx);
    // Synthetic integration examples, never live methodology authority.
    await tx.update(methodologyCriterion).set({ denominator_line_items: ["market_value_basis"],
      threshold: 30, threshold_unit: "percent_of_market_cap", borderline_margin: null }).where(eq(methodologyCriterion.id, f.debt.id));
    await tx.update(methodologyCriterion).set({ criterion_type: "custom_ratio",
      numerator_line_items: ["prohibited_income"], denominator_line_items: ["total_revenue"],
      threshold: 5, threshold_unit: "percent_of_total_revenue", threshold_direction: "max",
      borderline_margin: null }).where(eq(methodologyCriterion.id, f.business.id));
    await tx.insert(financialFact).values([
      { company_id: f.c.id, period_id: f.p.id, line_item: "total_equity", value: 0, source_id: f.src.id, is_demo: true },
      { company_id: f.c.id, period_id: f.p.id, line_item: "total_revenue", value: 100, source_id: f.src.id, is_demo: true },
      { company_id: f.c.id, period_id: f.p.id, line_item: "prohibited_income", value: 5, input_state: "estimated", confidence_tier: "Estimated", source_id: f.src.id, is_demo: true },
    ]);
    for (const end of ["2026-07-31", "2026-08-31", "2026-09-30"]) await tx.insert(priceBar).values({
      security_id: f.s.id, date: end, month_end_for: end, close: 1, currency: "USD",
      source_id: f.src.id, source_label: "Synthetic last trading-day assertion", is_synthetic: false, is_demo: true });
    const first = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    const [run] = await tx.select().from(screeningRun).where(eq(screeningRun.id, first.runId));
    expect(run).toMatchObject({ status: "passes_selected_methodology", confidence: "Medium", data_adequacy: "adequate_with_estimates" });
    const [basis] = await tx.select().from(financialFact).where(and(eq(financialFact.security_id, f.s.id), eq(financialFact.is_current, true)));
    expect(basis).toMatchObject({ value: 100, input_state: "derived" });
    expect(JSON.parse(basis.mapping_note!).months).toHaveLength(3);
    const children = await tx.select().from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, run.id));
    expect(children.find(c => c.criterion_id === f.debt.id)?.source_ids).toContain(basis.source_id);
    await insertCurrent(tx, { company_id: f.c.id, period_id: f.p.id, line_item: "prohibited_income", value: 5.004,
      input_state: "estimated", confidence_tier: "Estimated", source_id: f.src.id, is_demo: true });
    const failed = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, failed.runId)))[0].status).toBe("fails_selected_methodology");
    expect(await verifyRun(run.id, tx)).toMatchObject({ valid: true });
    await insertCurrent(tx, { company_id: f.c.id, period_id: f.p.id, line_item: "prohibited_income", value: 1,
      input_state: "reported", source_id: f.src.id, is_demo: true });
    const rollover = await screenSecurity(f.s.id, f.v.id, { ...options, asOf: "2027-01-01" }, f.mutate);
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, rollover.runId)))[0]).toMatchObject({
      status: "passes_selected_methodology", confidence: "Medium", data_adequacy: "adequate_with_estimates",
    });
    expect(await screenSecurity(f.s.id, f.v.id, { ...options, asOf: "2027-01-01" }, f.mutate)).toMatchObject({ unchanged: true });
    expect(await verifyRun(run.id, tx)).toMatchObject({ valid: true });
  }));
  it("same evidence/date creates one immutable run with every child and an audit", () => isolated(async tx => {
    const f = await setup(tx);
    const a = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    expect(a.unchanged).toBe(false);
    expect(await screenSecurity(f.s.id, f.v.id, options, f.mutate)).toEqual({ unchanged: true, runId: a.runId });
    const runs = await tx.select().from(screeningRun).where(eq(screeningRun.security_id, f.s.id));
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ticker: "SYNTH", company_name: f.c.name, methodology_name: f.m.name,
      methodology_version_label: f.v.version_label, financial_period_label: f.p.fiscal_period_label,
      engine_version: "engine-1.0.2", calculation_version: "calc-2026.10.6" });
    expect((runs[0].hash_payload as Record<string, unknown>).as_of).toBe(options.asOf);
    expect((await tx.select().from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, a.runId)))).toHaveLength(2);
    expect((await tx.select().from(auditEvent).where(eq(auditEvent.entity_id, a.runId)))).toHaveLength(1);
    expect(await verifyRun(a.runId, tx)).toMatchObject({ valid: true });
  }));
  it("a changed fact appends and never mutates the earlier run; old replay survives later edits", () => isolated(async tx => {
    const f = await setup(tx), first = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    const [before] = await tx.select().from(screeningRun).where(eq(screeningRun.id, first.runId));
    await insertCurrent(tx, { company_id: f.c.id, period_id: f.p.id, line_item: "interest_bearing_debt",
      value: 20, source_id: f.src.id, is_demo: true });
    const second = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    expect(second.runId).not.toBe(first.runId);
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, first.runId)))[0]).toEqual(before);
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, second.runId)))[0].immutable_hash).not.toBe(before.immutable_hash);
    expect(await screenSecurity(f.s.id, f.v.id, options, f.mutate)).toEqual({ unchanged: true, runId: second.runId });
    await tx.update(methodologyCriterion).set({ threshold: 1 }).where(eq(methodologyCriterion.id, f.debt.id));
    await tx.delete(businessSegment).where(eq(businessSegment.company_id, f.c.id));
    expect(await verifyRun(first.runId, tx)).toMatchObject({ valid: true });
  }));
  it("D-13: no segments is a business activity review unknown", () => isolated(async tx => {
    const f = await setup(tx);
    await tx.delete(businessSegment).where(eq(businessSegment.company_id, f.c.id));
    const r = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    const unknowns = await tx.select().from(screeningUnknown).where(eq(screeningUnknown.screening_run_id, r.runId));
    expect(unknowns).toEqual(expect.arrayContaining([expect.objectContaining({ criterion_id: f.business.id, severity: "review" })]));
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, r.runId)))[0].status).toBe("requires_review");
  }));
  it("missing assets is insufficient data; missing survives in stored criterion states", () => isolated(async tx => {
    const f = await setup(tx);
    await tx.update(financialFact).set({ is_current: false }).where(and(eq(financialFact.company_id, f.c.id), eq(financialFact.line_item, "total_assets")));
    const r = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    expect((await tx.select().from(screeningRun).where(eq(screeningRun.id, r.runId)))[0].status).toBe("insufficient_data");
    const [criterion] = await tx.select().from(screeningCriterionResult).where(and(eq(screeningCriterionResult.screening_run_id, r.runId), eq(screeningCriterionResult.criterion_id, f.debt.id)));
    expect(criterion.input_states).toContain("missing");
  }));
  it("a missing period fails explicitly without inventing evidence", () => isolated(async tx => {
    const f = await setup(tx);
    await tx.update(financialPeriod).set({ is_latest: false }).where(eq(financialPeriod.id, f.p.id));
    await expect(screenSecurity(f.s.id, f.v.id, options, f.mutate)).rejects.toThrow("No financial period to screen");
    expect(await tx.select().from(screeningRun).where(eq(screeningRun.security_id, f.s.id))).toHaveLength(0);
  }));
  it.each([true, false])("verifies historical hashes without replay through stored-row reads (intact: %s)", intact => isolated(async tx => {
    const f = await setup(tx), r = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    const [original] = await tx.select().from(screeningRun).where(eq(screeningRun.id, r.runId));
    const payload = structuredClone(original.hash_payload);
    payload.engine_version = "engine-0.9.0";
    const immutableHash = hash(payload);
    if (!intact) payload.outputs.confidence = "Low";
    const [historical] = await tx.insert(screeningRun).values({
      ...original, id: randomUUID(), engine_version: payload.engine_version,
      hash_payload: payload, immutable_hash: immutableHash,
    }).returning();
    expect(await verifyRun(historical.id, tx)).toMatchObject({
      valid: intact, hashMatches: intact, replaySupported: false, replayMatches: null,
      engineVersion: "engine-0.9.0",
      differences: intact ? [] : [{ path: "$.immutable_hash", expected: immutableHash, actual: hash(payload) }],
    });
  }));
  it("detects payload tampering with the append-only trigger explicitly disabled only here", () => isolated(async tx => {
    const f = await setup(tx), r = await screenSecurity(f.s.id, f.v.id, options, f.mutate);
    await tx.execute(query`set local role postgres`);
    await tx.execute(query`alter table app.screening_run disable trigger user`);
    try {
      await tx.execute(query`update app.screening_run set hash_payload = jsonb_set(hash_payload, '{outputs,confidence}', '"Low"') where id = ${r.runId}`);
    } finally { await tx.execute(query`alter table app.screening_run enable trigger user`); }
    await tx.execute(query`set local role suhail_app`);
    expect(await verifyRun(r.runId, tx)).toMatchObject({ valid: false, hashMatches: false, replayMatches: false });
  }));
  it("live bulk has no writes and exact gate message; manual examples are rejected", () => isolated(async tx => {
    const f = await setup(tx);
    const before = await tx.select().from(jobRun), audits = await tx.select().from(auditEvent);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(await screenUniverse(undefined, f.mutate)).toMatchObject({ message: "No production methodology to screen with", summary: { processed: 0, status: "skipped" } });
      expect(await tx.select().from(jobRun)).toEqual(before);
      expect(await tx.select().from(auditEvent)).toEqual(audits);
      await expect(screenSecurity(f.s.id, f.v.id, options, f.mutate)).rejects.toThrow("Demo and example methodologies cannot screen live securities");
    } finally { vi.unstubAllEnvs(); }
  }));
  it("resumes after a lost checkpoint, reuses the job UTC date and logs unchanged without a duplicate", () => isolated(async tx => {
    const f = await setup(tx);
    await tx.update(security).set({ in_universe: false });
    await tx.update(security).set({ in_universe: true }).where(eq(security.id, f.s.id));
    await tx.insert(security).values({ ticker: "SYNTH.B", slug: `s8-${randomUUID()}`,
      company_id: f.c.id, exchange_id: f.s.exchange_id, in_universe: true, is_demo: true });
    await tx.update(methodologyVersion).set({ is_public: true }).where(eq(methodologyVersion.id, f.v.id));
    const [setting] = await tx.select().from(editorialSetting).where(eq(editorialSetting.setting_key, "editorial"));
    if (setting) await tx.update(editorialSetting).set({ default_shariah_methodology_version_id: f.v.id }).where(eq(editorialSetting.id, setting.id));
    else await tx.insert(editorialSetting).values({ default_shariah_methodology_version_id: f.v.id });
    let calls = 0;
    const crash: Mutation = work => { calls++; if (calls === 5) throw new Error("simulated lost checkpoint"); return f.mutate(work); };
    await expect(runScreenBatch(undefined, crash, undefined, () => new Date("2026-10-16T23:59:59Z"))).rejects.toThrow("simulated lost checkpoint");
    const [job] = await tx.select().from(jobRun).where(eq(jobRun.job_name, "screen-universe"));
    expect(job.cursor?.next).toBe(0);
    expect(await tx.select().from(screeningRun).where(eq(screeningRun.company_id, f.c.id))).toHaveLength(1);
    const resumed = await runScreenBatch(job.id, f.mutate, undefined, () => new Date("2026-10-17T00:01:00Z"));
    expect(resumed.summary).toMatchObject({ status: "paused", inserted: 0, unchanged: 1, processed: 1 });
    const finished = await runScreenBatch(job.id, f.mutate, undefined, () => new Date("2026-10-17T01:00:00Z"));
    expect(finished.summary).toMatchObject({ status: "completed", inserted: 1, unchanged: 1, processed: 2 });
    const [done] = await tx.select().from(jobRun).where(eq(jobRun.id, job.id));
    expect(done.cursor).toMatchObject({ next: 2, asOf: "2026-10-16",
      log: [expect.objectContaining({ unchanged: true }), expect.objectContaining({ unchanged: false })] });
    const runs = await tx.select().from(screeningRun).where(eq(screeningRun.company_id, f.c.id));
    expect(runs).toHaveLength(2);
    expect(runs.every(r => (r.hash_payload as Record<string, unknown>).as_of === "2026-10-16")).toBe(true);
  }));
});
