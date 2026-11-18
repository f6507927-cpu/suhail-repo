import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import type { Sql } from "postgres";
import * as schema from "../src/db/schema";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import type { AppUser, Tx } from "../src/lib/auth/audit";
import { updateResearchSettings, updateResearchGate } from "../src/lib/research/settings";
import { activeResearchStocks, reconcileRequestedDraft, reserveDraftBudget, settleDraftBudget } from "../src/lib/research/store";
import { assertScope, type ScopeSettings } from "../src/lib/research/workflow";
import { fixturePackets } from "./fixtures/research/packets";
vi.mock("server-only", () => ({}));
let db: Sql;
const rollback = new Error("rollback research fixture");
const scope: ScopeSettings = { monthly_token_budget: 10000, max_active_research_stocks: 1,
  allowed_sectors: [{ sector: "Technology", limit: 1 }], max_packet_age_days: 30,
  max_financial_age_days: 550, price_move_threshold_percent: 10, publication_age_days: 90 };
beforeAll(async () => { db = cliConnection("DATABASE_URL_TEST"); await applyMigrations(db); });
afterAll(async () => { await db?.end(); });
async function fixture(tx: Tx) {
  const actor = { id: randomUUID(), email: null, role: "admin" } as AppUser;
  const company = randomUUID(), stock = randomUUID(), packet = randomUUID(), draft = randomUUID();
  await tx.execute(sql`insert into app.company(id,name,sector_label,is_demo) values(${company},'Synthetic fixture','Technology',false)`);
  await tx.execute(sql`insert into app.security(id,company_id,ticker,slug,is_demo)
    values(${stock},${company},'SYN',${"syn-" + stock},false)`);
  await tx.execute(sql`insert into app.research_packet(id,security_id,packet_schema_version,packet_hash,payload,built_at)
    values(${packet},${stock},'fixture','fixture',${JSON.stringify(fixturePackets[0])}::text::jsonb,'2026-11-01T00:00:00Z')`);
  await tx.execute(sql`insert into app.research_draft(id,security_id,packet_id,prompt_version,validator_version)
    values(${draft},${stock},${packet},'fixture','fixture')`);
  await tx.execute(sql`set local role suhail_app`);
  await updateResearchSettings(tx, actor, scope);
  return { actor, stock, draft };
}
async function run(work: (tx: Tx, f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  try {
    await drizzle(db, { schema }).transaction(async tx => { const f = await fixture(tx); await work(tx, f); throw rollback; });
  } catch (error) { if (error !== rollback) throw error; }
}
describe("PR19 settings audit and abandoned reservations", () => {
  it("audits every scope value before and after, in the same transaction", async () => {
    await run(async (tx, f) => {
      const after = { ...scope, monthly_token_budget: 20000, max_active_research_stocks: 4,
        allowed_sectors: [{ sector: "Technology", limit: 2 }], max_packet_age_days: 45,
        max_financial_age_days: 500, price_move_threshold_percent: 15, publication_age_days: 60 };
      await updateResearchSettings(tx, f.actor, after);
      const rows = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.actor_id, f.actor.id));
      const event = rows.find(row => row.details?.after && (row.details.after as Record<string, unknown>).monthly_token_budget === 20000);
      expect(event?.details).toMatchObject({
        before: { ...scope, price_move_threshold_percent: "10" },
        after: { ...after, price_move_threshold_percent: "15" },
      });
      expect((await tx.select().from(schema.researchSetting))[0].monthly_token_budget).toBe(20000);
    });
  });
  it("keeps the enabled gate's evidence in the disable audit after clearing its live columns", async () => {
    await run(async (tx, f) => {
      await updateResearchGate(tx, f.actor, true, "D-217", "lawyer-fixture");
      await updateResearchGate(tx, f.actor, false, "", "");
      const [setting] = await tx.select().from(schema.researchSetting);
      expect(setting).toMatchObject({ ai_research_publishing: false, gate_decision_id: null, gate_lawyer_answer_ref: null });
      const rows = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.actor_id, f.actor.id));
      const events = rows.filter(row => row.event_type === "research_gate");
      expect(events).toHaveLength(2);
      expect(events.find(row => (row.details?.after as Record<string, unknown>).enabled === false)?.details).toMatchObject({
        before: { enabled: true, decision_id: "D-217", lawyer_reference: "lawyer-fixture", enabled_by: f.actor.id },
        after: { enabled: false, decision_id: null, lawyer_reference: null, enabled_by: null, enabled_at: null },
      });
    });
  });
  it("reconciles, releases only its reservation, and frees the active-stock cap", async () => {
    await run(async (tx, f) => {
      const attempt = await reserveDraftBudget(tx, f.actor, f.draft, "2099-01-01", 6000);
      expect(attempt).toBe(1);
      // A different draft's month reservation must not be consumed by reconciliation.
      await tx.execute(sql`update app.research_usage set reserved=reserved+500 where month='2099-01-01'`);
      const before = await activeResearchStocks(tx);
      expect(before).toHaveLength(1);
      expect(() => assertScope(scope, { covered: true, in_universe: true, sector: "Technology" },
        before, randomUUID())).toThrow();
      await reconcileRequestedDraft(tx, f.actor, f.draft);
      const [draft] = await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, f.draft));
      expect(draft).toMatchObject({ state: "failed", failure_reason: "abandoned", reserved_tokens: 0, attempts: 1 });
      const [usage] = await tx.select().from(schema.researchUsage).where(eq(schema.researchUsage.month, "2099-01-01"));
      expect(usage).toMatchObject({ used: 0, reserved: 500 });
      const active = await activeResearchStocks(tx);
      expect(active).toHaveLength(0);
      // Use the same production active-stock query; this fixture's count is now zero.
      expect(() => assertScope(scope, { covered: true, in_universe: true, sector: "Technology" },
        active, randomUUID())).not.toThrow();
      const audits = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.actor_id, f.actor.id));
      expect(audits.find(row => row.summary === "research_transition")?.details).toMatchObject({
        reason: "abandoned", released_tokens: 6000, month: "2099-01-01",
      });
      await reconcileRequestedDraft(tx, f.actor, f.draft);
      expect((await tx.select().from(schema.researchUsage).where(eq(schema.researchUsage.month, "2099-01-01")))[0].reserved).toBe(500);
      expect(await reserveDraftBudget(tx, f.actor, f.draft, "2099-01-01", 1000)).toBeNull();
    });
  });
  it("accounts late usage exactly once without a second release or resurrection", async () => {
    await run(async (tx, f) => {
      await reserveDraftBudget(tx, f.actor, f.draft, "2099-02-01", 6000);
      await reconcileRequestedDraft(tx, f.actor, f.draft);
      await settleDraftBudget(tx, f.actor, f.draft, 1, 6000, 180);
      await settleDraftBudget(tx, f.actor, f.draft, 1, 6000, 180);
      expect((await tx.select().from(schema.researchUsage).where(eq(schema.researchUsage.month, "2099-02-01")))[0])
        .toMatchObject({ used: 180, reserved: 0 });
      expect((await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, f.draft)))[0].state).toBe("failed");
    });
  });
  it("handles abandonment before any reserve, and refuses completed drafts", async () => {
    await run(async (tx, f) => {
      await reconcileRequestedDraft(tx, f.actor, f.draft);
      expect((await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, f.draft)))[0])
        .toMatchObject({ state: "failed", failure_reason: "abandoned" });
      // A generated draft is not an abandoned request.
      await tx.execute(sql`insert into app.research_draft(security_id,packet_id,prompt_version,validator_version)
        select security_id,packet_id,'fixture','fixture' from app.research_draft where id=${f.draft}`);
      const [next] = await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.state, "requested"));
      await tx.update(schema.researchDraft).set({ state: "generated" }).where(eq(schema.researchDraft.id, next.id));
      await expect(reconcileRequestedDraft(tx, f.actor, next.id)).rejects.toThrow("Only requested");
    });
  });
  it("settles each attempt before the retry and releases the retry's own month only", async () => {
    await run(async (tx, f) => {
      expect(await reserveDraftBudget(tx, f.actor, f.draft, "2099-03-01", 6000)).toBe(1);
      expect(await reserveDraftBudget(tx, f.actor, f.draft, "2099-03-01", 6000)).toBeNull();
      await settleDraftBudget(tx, f.actor, f.draft, 1, 6000, 200);
      expect(await reserveDraftBudget(tx, f.actor, f.draft, "2099-04-01", 6000)).toBe(2);
      await reconcileRequestedDraft(tx, f.actor, f.draft);
      const usage = await tx.select().from(schema.researchUsage);
      expect(usage.find(row => row.month === "2099-03-01")).toMatchObject({ used: 200, reserved: 0 });
      expect(usage.find(row => row.month === "2099-04-01")).toMatchObject({ used: 0, reserved: 0 });
    });
  });
});
