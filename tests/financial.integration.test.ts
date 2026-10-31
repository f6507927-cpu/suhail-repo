import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, sql as query } from "drizzle-orm";
import type { Sql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import * as schema from "../src/db/schema";
import { company, financialFact, financialPeriod, priceBar, source, businessSegment, security } from "../src/db/schema/market";
import { auditEvent, jobRun, analystProfile } from "../src/db/schema/accounts";
import { mapAnnual } from "../src/ingest/sec/annual";
import type { Fixture } from "../src/ingest/sec/types";
import { persistAnnual, type Actor } from "../src/lib/financial/persistence";
import { addSecurity, mutateFinancial } from "../src/lib/financial/service";
import { refreshMarketValue } from "../src/lib/financial/market-value-persistence";
import { completedQuarter } from "../src/lib/financial/market-value";
import type { Tx } from "../src/lib/auth/audit";
// eslint-disable-next-line no-restricted-imports -- Isolated job test injects its local transaction and fake SEC transport.
import { runIngestBatch } from "../src/jobs/ingest-sec";
import type { Mutation } from "../src/ingest/sec/ingest";
vi.mock("server-only", () => ({}));
vi.mock("../src/env/jobs-env", () => ({ getJobsEnv: () => ({ JOB_BATCH_SIZE: 1 }) }));

let connection: Sql;
const rollback = new Error("rollback isolated financial test");
const fixture = JSON.parse(readFileSync("tests/fixtures/sec/aapl.json", "utf8")) as Fixture;
const mapped = () => mapAnnual(fixture.companyfacts, fixture.metadata);
const actor: Actor = null;
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
  } catch (e) { if (e !== rollback) throw e; }
}
async function setup(tx: Tx) {
  const id = await addSecurity(tx, actor, { cik: "0000320193", ticker: "AAPL", name: "Test issuer",
    exchange: "NASDAQ", sector: "Synthetic test label", fiscalYearEnd: "0930" });
  const [s] = await tx.select().from(security).where(eq(security.id, id));
  const result = await persistAnnual(tx, actor, s.company_id!, mapped());
  return { id, companyId: s.company_id!, periodId: result.periodId };
}
const note = { label: "Synthetic analyst evidence", source_type: "internal" as const };
async function current(tx: Tx, periodId: string, line = "total_assets") {
  const [row] = await tx.select().from(financialFact).where(and(
    eq(financialFact.period_id, periodId), eq(financialFact.line_item, line), eq(financialFact.is_current, true)));
  return row;
}
function changed(value: number, yearShift = false) {
  const m = mapped();
  m.period.is_demo = true;
  if (yearShift) {
    m.period.fiscal_year++; m.period.fiscal_period_label = `FY${m.period.fiscal_year}`;
    m.period.period_end = "2026-09-26"; m.period.period_start = "2025-09-28";
  }
  for (const f of m.facts) {
    if (f.line_item === "total_assets") f.value = value;
    if (f.source) f.source = { ...f.source, document_reference: `${f.source.document_reference}-synthetic-${value}`,
      source_url: `https://example.test/filing/${value}`, is_synthetic: true, is_demo: true, production_blocked: true };
  }
  return m;
}
describe("Step 7 financial persistence and analyst actions", () => {
  it("persists quarterly basis traces, deduplicates prices and refreshes corrections and shared inputs", () => isolated(async tx => {
    const ctx = await setup(tx);
    const asOf = new Date().toISOString().slice(0, 10);
    const ends = completedQuarter(asOf).monthEnds;
    const basis = async (id = ctx.id) => (await tx.select().from(financialFact).where(and(
      eq(financialFact.security_id, id), eq(financialFact.period_id, ctx.periodId),
      eq(financialFact.line_item, "market_value_basis"), eq(financialFact.is_current, true))))[0];
    expect(await basis()).toMatchObject({ value: null, input_state: "unknown" });
    const priceData = (date: string, close = "10") => ({ date, close, month_end_for: date,
      currency: "USD", source_label: "Synthetic sourced month-end assertion", source_url: "https://example.test/close" });
    const write = (data: Record<string, unknown>, id = ctx.id) =>
      mutateFinancial(tx, actor, { operation: "price", securityId: id, data });
    for (const end of ends) await write(priceData(end));
    let shares = await current(tx, ctx.periodId, "shares_outstanding");
    const first = await basis();
    expect(first).toMatchObject({ value: shares.value! * 10, input_state: "derived", confidence_tier: "Calculated", security_id: ctx.id });
    const trace = JSON.parse(first.mapping_note!);
    expect(trace.months).toHaveLength(3);
    expect(trace.shares.id).toBe(shares.id);
    expect(trace.sourceIds).toHaveLength(5); // Three price sources plus annual equity and later DEI filing.
    expect(trace.months.every((m: { marketValue: number }) => m.marketValue === shares.value! * 10)).toBe(true);
    const counts = async () => Promise.all([tx.select().from(financialFact), tx.select().from(priceBar), tx.select().from(source), tx.select().from(auditEvent)]).then(rows => rows.map(r => r.length));
    const before = await counts();
    await write(priceData(ends[2]));
    await refreshMarketValue(tx, actor, ctx.companyId, ctx.id, asOf);
    expect(await counts()).toEqual(before);
    await write(priceData(ends[2], "13"));
    expect((await basis()).value).toBe(shares.value! * 11);
    expect((await basis()).id).not.toBe(first.id);
    // A reversal is new current evidence, not a duplicate of a historical row.
    const reversal = await write(priceData(ends[2]));
    const reversed = await basis();
    expect(reversed.value).toBe(shares.value! * 10);
    const reversedMonth = JSON.parse(reversed.mapping_note!).months[2];
    expect(reversedMonth.price).toMatchObject({ id: reversal, close: 10 });
    expect((await current(tx, ctx.periodId, "market_cap")).value).toBe(shares.value! * 10);
    const reversedCounts = await counts();
    expect(await write(priceData(ends[2]))).toBe(reversal);
    expect(await counts()).toEqual(reversedCounts);
    // A changed actual trading date in the same attested month also supersedes it.
    await write({ ...priceData(ends[2], "12"), date: `${ends[2].slice(0, 8)}29` });
    expect((await basis()).value).toBeCloseTo(shares.value! * (32 / 3), 2);
    const dateReversal = await write(priceData(ends[2]));
    expect(JSON.parse((await basis()).mapping_note!).months[2].price).toMatchObject({ id: dateReversal, close: 10 });
    expect((await basis()).value).toBe(shares.value! * 10);
    // Preserve the subsequent shared-input assertions against a mean close of 11.
    await write(priceData(ends[2], "13"));
    const sibling = await addSecurity(tx, actor, { cik: "0000320193", ticker: "SYNTH.SECOND", name: "Synthetic share class",
      exchange: "NYSE", sector: "", fiscalYearEnd: "" });
    for (const end of ends) await write(priceData(end, "20"), sibling);
    expect((await basis(sibling)).value).toBe(shares.value! * 20);
    const changedShares = mapped();
    changedShares.facts.find(f => f.line_item === "shares_outstanding")!.value = 12000000000;
    await persistAnnual(tx, actor, ctx.companyId, changedShares);
    expect((await basis()).value).toBe(132000000000);
    expect((await basis(sibling)).value).toBe(240000000000);
    shares = await current(tx, ctx.periodId, "shares_outstanding");
    const override = { factId: shares.id, value: "10000000000", input_state: "estimated", confidence_tier: "Estimated",
      reason: "Synthetic shares correction", source: note };
    await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id, data: override });
    expect(await basis()).toMatchObject({ value: 110000000000, input_state: "estimated", confidence_tier: "Estimated" });
    expect((await basis(sibling)).value).toBe(200000000000);
    const stable = await counts();
    // Identical evidence submitted against the new current fact is a no-op.
    const newShares = await current(tx, ctx.periodId, "shares_outstanding");
    await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id, data: { ...override, factId: newShares.id } });
    expect(await counts()).toEqual(stable);
    const equity = await current(tx, ctx.periodId, "total_equity");
    await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id, data: {
      factId: equity.id, value: "300000000000", input_state: "reported", confidence_tier: "Verified", reason: "Synthetic equity floor", source: note } });
    expect((await basis()).value).toBe(300000000000);
    expect((await basis(sibling)).value).toBe(300000000000);
    // Import retains protected values, accepting a stored alternative refreshes every share class.
    const remapped = mapped();
    remapped.facts.find(f => f.line_item === "total_equity")!.value = 400000000000;
    await persistAnnual(tx, actor, ctx.companyId, remapped);
    expect((await basis()).value).toBe(300000000000);
    const incoming = (await tx.select().from(financialFact)).find(f => f.company_id === ctx.companyId && f.line_item === "total_equity" && f.value === 400000000000)!;
    await mutateFinancial(tx, actor, { operation: "accept", securityId: ctx.id, data: { factId: incoming.id } });
    expect((await basis()).value).toBe(400000000000);
    expect((await basis(sibling)).value).toBe(400000000000);
    await expect(write({ ...priceData("2026-05-29"), month_end_for: "2026-06-30" })).rejects.toThrow("same calendar month");
    await expect(write({ ...priceData("2026-05-29"), month_end_for: "2026-05-30" })).rejects.toThrow("same calendar month");
    const rollover = "2027-01-01";
    await refreshMarketValue(tx, actor, ctx.companyId, ctx.id, rollover);
    expect(await basis()).toMatchObject({ value: 400000000000, input_state: "estimated" });
    expect(JSON.parse((await basis()).mapping_note!).freshnessNote).toBe("prices from 2026 Q3");
  }));
  it("adds only absent period-aligned prohibited income and preserves sourced overrides on import", () => isolated(async tx => {
    const ctx = await setup(tx);
    const [period] = await tx.select().from(financialPeriod).where(eq(financialPeriod.id, ctx.periodId));
    const old = await current(tx, ctx.periodId, "prohibited_income");
    expect(old).toMatchObject({ value: null, input_state: "unknown" });
    const data = { periodId: period.id, period_start: period.period_start, period_end: period.period_end,
      value: "100", input_state: "estimated", confidence_tier: "Estimated", reason: "Synthetic conservative gross total", source: note };
    await expect(mutateFinancial(tx, actor, { operation: "addProhibitedIncome", securityId: ctx.id, data })).rejects.toThrow("already exists");
    await tx.update(financialFact).set({ is_current: false }).where(eq(financialFact.id, old.id));
    await expect(mutateFinancial(tx, actor, { operation: "addProhibitedIncome", securityId: ctx.id,
      data: { ...data, period_end: "2025-12-31" } })).rejects.toThrow("annual revenue period");
    const added = await mutateFinancial(tx, actor, { operation: "addProhibitedIncome", securityId: ctx.id, data });
    expect(await current(tx, ctx.periodId, "prohibited_income")).toMatchObject({ id: added, value: 100, protected_current: true });
    const changed = mapped();
    const incoming = changed.facts.find(f => f.line_item === "prohibited_income")!;
    Object.assign(incoming, { value: 123, input_state: "estimated", confidence_tier: "Estimated",
      mapping_note: "Synthetic changed SEC proxy, not real issuer evidence" });
    await persistAnnual(tx, actor, ctx.companyId, changed);
    const all = await tx.select().from(financialFact).where(and(eq(financialFact.company_id, ctx.companyId), eq(financialFact.line_item, "prohibited_income")));
    const alternative = all.find(f => f.value === 123)!;
    expect(alternative).toMatchObject({ is_current: false, origin: "sec" });
    expect((await current(tx, ctx.periodId, "prohibited_income")).id).toBe(added);
    const count = all.length;
    await persistAnnual(tx, actor, ctx.companyId, changed);
    expect(await tx.select().from(financialFact).where(and(eq(financialFact.company_id, ctx.companyId), eq(financialFact.line_item, "prohibited_income")))).toHaveLength(count);
    await expect(mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id, data: {
      ...data, factId: added, input_state: "reported", confidence_tier: "Estimated" } })).rejects.toThrow("reported/Verified");
    await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id, data: {
      ...data, factId: added, input_state: "reported", confidence_tier: "Verified", value: "150" } });
    expect(await current(tx, ctx.periodId, "prohibited_income")).toMatchObject({ value: 150, input_state: "reported", confidence_tier: "Verified" });
    await mutateFinancial(tx, actor, { operation: "accept", securityId: ctx.id, data: { factId: alternative.id } });
    expect(await current(tx, ctx.periodId, "prohibited_income")).toMatchObject({ value: 123, protected_current: false });
  }));
  it("reuses issuer/listing/source identities and identical imports add no facts", () => isolated(async tx => {
    const ctx = await setup(tx);
    const before = await tx.select().from(financialFact);
    const sources = await tx.select().from(source);
    expect(await persistAnnual(tx, actor, ctx.companyId, mapped())).toMatchObject({ inserted: 0, promoted: 0 });
    expect(await tx.select().from(financialFact)).toHaveLength(before.length);
    expect(await tx.select().from(source)).toHaveLength(sources.length);
    const second = await addSecurity(tx, actor, { cik: "0000320193", ticker: "AAPL", name: "Test issuer",
      exchange: "NASDAQ", sector: "", fiscalYearEnd: "" });
    expect(second).toBe(ctx.id);
    const share = await addSecurity(tx, actor, { cik: "0000320193", ticker: "TEST.B", name: "Test issuer",
      exchange: "NYSE", sector: "", fiscalYearEnd: "" });
    const [other] = await tx.select().from(security).where(eq(security.id, share));
    expect(other.company_id).toBe(ctx.companyId);
  }));
  it("changed evidence supersedes atomically without changing historical values", () => isolated(async tx => {
    const ctx = await setup(tx), old = await current(tx, ctx.periodId);
    await persistAnnual(tx, actor, ctx.companyId, changed(200));
    expect((await current(tx, ctx.periodId)).value).toBe(200);
    const [history] = await tx.select().from(financialFact).where(eq(financialFact.id, old.id));
    expect(history).toMatchObject({ value: old.value, source_id: old.source_id, is_current: false });
  }));
  it("retains and deduplicates incoming SEC evidence behind a protected correction, then accepts it", () => isolated(async tx => {
    const ctx = await setup(tx), baseline = await current(tx, ctx.periodId);
    const corrected = await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id,
      data: { factId: baseline.id, value: "100", input_state: "estimated", confidence_tier: "Estimated",
        reason: "Synthetic correction", source: note } });
    expect(await current(tx, ctx.periodId)).toMatchObject({ id: corrected, protected_current: true, sec_baseline_id: baseline.id });
    await persistAnnual(tx, actor, ctx.companyId, changed(200));
    expect((await current(tx, ctx.periodId)).id).toBe(corrected);
    const incoming = (await tx.select().from(financialFact)).find(f => f.line_item === "total_assets" && f.value === 200)!;
    expect(incoming).toMatchObject({ origin: "sec", is_current: false });
    expect(await persistAnnual(tx, actor, ctx.companyId, changed(200))).toMatchObject({ inserted: 0 });
    await mutateFinancial(tx, actor, { operation: "accept", securityId: ctx.id, data: { factId: incoming.id } });
    expect(await current(tx, ctx.periodId)).toMatchObject({ id: incoming.id, protected_current: false });
    await persistAnnual(tx, actor, ctx.companyId, changed(300));
    expect((await current(tx, ctx.periodId)).value).toBe(300);
    const events = await tx.select().from(auditEvent).where(eq(auditEvent.entity_id, ctx.id));
    expect(events.some(e => e.summary.includes("protection released"))).toBe(true);
  }));
  it("protection never blocks the same line item in a new fiscal period", () => isolated(async tx => {
    const ctx = await setup(tx), old = await current(tx, ctx.periodId);
    await mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id,
      data: { factId: old.id, value: "100", input_state: "reported", confidence_tier: "Verified", reason: "Test", source: note } });
    const next = await persistAnnual(tx, actor, ctx.companyId, changed(400, true));
    expect(next.periodId).not.toBe(ctx.periodId);
    expect(await current(tx, next.periodId)).toMatchObject({ value: 400, protected_current: false });
    expect(await current(tx, ctx.periodId)).toMatchObject({ value: 100, protected_current: true });
    expect((await tx.select().from(financialPeriod).where(eq(financialPeriod.is_latest, true)))
      .filter(p => p.company_id === ctx.companyId)).toHaveLength(1);
  }));
  it("filing confirmation inserts Verified investments and refuses other lines", () => isolated(async tx => {
    const ctx = await setup(tx), investments = await current(tx, ctx.periodId, "interest_bearing_investments");
    const evidence = { label: "Synthetic filing note", source_type: "regulatory_filing", source_url: "https://example.test/note",
      document_reference: "Synthetic note 3" };
    await mutateFinancial(tx, actor, { operation: "confirm", securityId: ctx.id,
      data: { factId: investments.id, reason: "Confirmed from synthetic test note", source: evidence } });
    expect(await current(tx, ctx.periodId, "interest_bearing_investments")).toMatchObject({
      value: investments.value, input_state: "reported", confidence_tier: "Verified", protected_current: true });
    await expect(mutateFinancial(tx, actor, { operation: "confirm", securityId: ctx.id,
      data: { factId: (await current(tx, ctx.periodId)).id, reason: "Wrong line", source: evidence } }))
      .rejects.toThrow("estimated investments");
  }));
  it("segment CRUD derives shares and requires a classification basis", () => isolated(async tx => {
    const ctx = await setup(tx);
    const data = { segment_name: "Synthetic segment", revenue_amount: "41616100000", activity_category: "unclassified",
      input_state: "reported", confidence_tier: "Verified", source: note };
    const id = await mutateFinancial(tx, actor, { operation: "segment", securityId: ctx.id, data });
    expect((await tx.select().from(businessSegment).where(eq(businessSegment.id, id)))[0])
      .toMatchObject({ revenue_share: 0.1, input_state: "derived", activity_category: "unclassified" });
    await expect(mutateFinancial(tx, actor, { operation: "segment", securityId: ctx.id,
      data: { ...data, id, activity_category: "technology" } })).rejects.toThrow("category basis");
    await mutateFinancial(tx, actor, { operation: "segment", securityId: ctx.id,
      data: { ...data, id, activity_category: "technology", category_basis: "Synthetic filing note" } });
    await mutateFinancial(tx, actor, { operation: "deleteSegment", securityId: ctx.id, data: { id } });
    expect(await tx.select().from(businessSegment).where(eq(businessSegment.id, id))).toHaveLength(0);
  }));
  it("manual close retains provenance and derives market cap with input references", () => isolated(async tx => {
    const ctx = await setup(tx), shares = await current(tx, ctx.periodId, "shares_outstanding");
    const id = await mutateFinancial(tx, actor, { operation: "price", securityId: ctx.id,
      data: { date: "2026-10-15", close: "12.345678", currency: "USD",
        source_label: "Synthetic manual price", source_url: "https://example.test/price" } });
    const [p] = await tx.select().from(priceBar).where(eq(priceBar.id, id));
    expect(p).toMatchObject({ is_synthetic: false, source_url: "https://example.test/price" });
    const cap = await current(tx, ctx.periodId, "market_cap");
    expect(cap).toMatchObject({ input_state: "derived", confidence_tier: "Calculated" });
    expect(cap.mapping_note).toContain(shares.id); expect(cap.mapping_note).toContain(p.id);
    const [exact] = await tx.execute(query`select value::text as value from app.financial_fact where id=${cap.id}`);
    expect(exact.value).toBe("180175046954.040000");
  }));
  it("missing shares create explicit unknown market cap, and removal retains company evidence", () => isolated(async tx => {
    const ctx = await setup(tx);
    const shares = await current(tx, ctx.periodId, "shares_outstanding");
    await tx.update(financialFact).set({ is_current: false }).where(eq(financialFact.id, shares.id));
    await mutateFinancial(tx, actor, { operation: "price", securityId: ctx.id,
      data: { date: "2026-10-15", close: "10", currency: "USD",
        source_label: "Synthetic manual price", source_url: "https://example.test/price" } });
    expect(await current(tx, ctx.periodId, "market_cap")).toMatchObject({ value: null, input_state: "unknown" });
    await mutateFinancial(tx, actor, { operation: "company", securityId: ctx.id,
      data: { name_ar: "اسم اختبار", description_ar: "وصف اختبار", description_en: "Synthetic description" } });
    const [analyst] = await tx.insert(analystProfile).values({ name_ar: "محلّل اختبار" }).returning();
    await mutateFinancial(tx, actor, { operation: "coverage", securityId: ctx.id, data: { analystId: analyst.id } });
    expect((await tx.select().from(security).where(eq(security.id, ctx.id)))[0].coverage_started_at).not.toBeNull();
    await mutateFinancial(tx, actor, { operation: "coverage", securityId: ctx.id, data: { analystId: null } });
    await mutateFinancial(tx, actor, { operation: "remove", securityId: ctx.id, data: { confirm: true } });
    expect((await tx.select().from(security).where(eq(security.id, ctx.id)))[0].in_universe).toBe(false);
    expect((await tx.select().from(company).where(eq(company.id, ctx.companyId)))[0].name_ar).toBe("اسم اختبار");
    expect(await current(tx, ctx.periodId)).toBeDefined();
  }));
  it("jobs checkpoint a failure, resume the next security, and finish without repeating it", () => isolated(async tx => {
    // Other integration suites leave their own universe fixtures; scope this job.
    await tx.update(security).set({ in_universe: false });
    await setup(tx);
    await addSecurity(tx, actor, { cik: "0000320193", ticker: "SYNTH.B", name: "Synthetic share class",
      exchange: "NYSE", sector: "", fiscalYearEnd: "" });
    const mutate: Mutation = work => work(tx, actor);
    const calls: string[] = [];
    const ingest = async (id: string) => {
      calls.push(id);
      if (calls.length === 1) throw new Error("Synthetic failure");
      return { inserted: 0, retained: 0, promoted: 0, periodId: "synthetic-only" };
    };
    const id = await runIngestBatch(undefined, mutate, ingest);
    const [paused] = await tx.select().from(jobRun).where(eq(jobRun.id, id));
    expect(paused).toMatchObject({ status: "paused", cursor: { next: 1 }, counts: { failed: 1, processed: 0 } });
    expect(paused.errors).toHaveLength(1);
    expect(paused.timings?.elapsed_ms).toBeGreaterThanOrEqual(0);
    await runIngestBatch(id, mutate, ingest);
    const [done] = await tx.select().from(jobRun).where(eq(jobRun.id, id));
    expect(done).toMatchObject({ status: "completed", counts: { failed: 1, processed: 1 }, cursor: { next: 2 } });
    expect(calls).toHaveLength(2); expect(calls[0]).not.toBe(calls[1]);
    await expect(runIngestBatch(id, mutate, ingest)).rejects.toThrow("Resumable ingestion job");
  }));
  it("rejects missing reasons and accepting an unprotected current fact", () => isolated(async tx => {
    const ctx = await setup(tx), f = await current(tx, ctx.periodId);
    await expect(mutateFinancial(tx, actor, { operation: "override", securityId: ctx.id,
      data: { factId: f.id, value: "1", input_state: "reported", confidence_tier: "Verified", reason: "", source: note } }))
      .rejects.toThrow();
    await expect(mutateFinancial(tx, actor, { operation: "accept", securityId: ctx.id, data: { factId: f.id } }))
      .rejects.toThrow("Stored SEC alternative");
    expect(await current(tx, ctx.periodId)).toMatchObject({ id: f.id, value: f.value });
  }));
});
