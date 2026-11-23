import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { sql as query } from "drizzle-orm";
import type { Sql, TransactionSql } from "postgres";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { researchTables } from "./db-fixtures";
import { fixturePackets } from "./fixtures/research/packets";
import { handwrittenModel } from "./fixtures/research/outputs";
import { assembleDraft } from "../src/ai/research/draft";
import { CHECKLIST } from "../src/lib/research/contracts";
vi.mock("server-only", () => ({}));
let db: Sql;
const rollback = new Error("rollback fixture");
beforeAll(async () => { db = cliConnection("DATABASE_URL_TEST"); await applyMigrations(db); });
afterAll(async () => { await db?.end(); });
async function inFixture(work: (tx: TransactionSql, f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  try {
    await db.begin(async tx => {
      const f = await fixture(tx);
      await work(tx, f);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
async function fixture(tx: TransactionSql) {
  const actor = randomUUID(), security = randomUUID(), packet = randomUUID(), draft = randomUUID();
  await tx`insert into app.users(id,full_name,role,is_demo) values(${actor},'Synthetic analyst','admin',false)`;
  await tx`insert into app.analyst_profile(user_id,name_ar,active,is_demo) values(${actor},'Synthetic fixture',true,false)`;
  await tx`insert into app.security(id,ticker,slug,is_demo) values(${security},'SYN',${"syn-" + security},false)`;
  await tx`insert into app.research_packet(id,security_id,packet_schema_version,packet_hash,payload,built_at)
    values(${packet},${security},'research-packet-1','fixture',${JSON.stringify(fixturePackets[0])}::text::jsonb,'2026-11-01T12:00:00Z')`;
  await tx`insert into app.research_draft(id,security_id,packet_id,prompt_version,validator_version)
    values(${draft},${security},${packet},'fixture-prompt','fixture-validator')`;
  return { actor, security, packet, draft };
}
async function generated(tx: TransactionSql, id: string) {
  const output = JSON.stringify(assembleDraft(handwrittenModel(fixturePackets[0]), fixturePackets[0]));
  await tx`update app.research_draft set state='generated',ai_output=${output}::text::jsonb,
    analyst_text=${output}::text::jsonb,text_hash='current-hash',validation_text_hash='current-hash',validation_results='[]'
    where id=${id}`;
  await tx`update app.research_draft set state='in_review' where id=${id}`;
}
async function review(tx: TransactionSql, id: string, actor: string, checklist: Record<string, boolean> = Object.fromEntries(CHECKLIST.map(k => [k, true]))) {
  await tx`insert into app.research_review_event(draft_id,actor_id,actor_role,to_state,text_hash,checklist,prompt_version,validator_version)
    values(${id},${actor},'admin','approved','current-hash',${JSON.stringify(checklist)}::text::jsonb,'fixture','fixture')`;
}
describe("D-216 private research PostgreSQL enforcement", () => {
  it.each(researchTables)("keeps %s inaccessible to the public role with RLS", async table => {
    const [row] = await db`select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='app' and c.relname=${table}`;
    expect(row.relrowsecurity).toBe(true);
    const [grants] = await db`select has_table_privilege('suhail_public',${"app." + table},'SELECT') read,
      has_table_privilege('suhail_public',${"app." + table},'INSERT') write`;
    expect(grants).toEqual({ read: false, write: false });
    await inFixture(async tx => {
      await tx`set local role suhail_public`;
      await expect(tx.savepoint(sp => sp.unsafe(`select * from app.${table}`))).rejects.toMatchObject({ code: "42501" });
    });
  });
  it("has only the intended application grants", async () => {
    for (const table of researchTables) {
      const [row] = await db`select has_table_privilege('suhail_app',${"app." + table},'SELECT') read,
        has_table_privilege('suhail_app',${"app." + table},'INSERT') insert,
        has_table_privilege('suhail_app',${"app." + table},'UPDATE') update,
        has_table_privilege('suhail_app',${"app." + table},'DELETE') delete`;
      expect(row).toEqual({ read: true, insert: table !== "research_setting",
        update: !["research_packet", "research_review_event", "research_staleness_event", "research_refresh", "research_publication_event"].includes(table), delete: false });
    }
  });
  it.each(["research_packet", "research_review_event"])("refuses owner UPDATE/DELETE/TRUNCATE of %s", async table => {
    await inFixture(async (tx, f) => {
      await review(tx, f.draft, f.actor);
      for (const statement of [`update app.${table} set id=id`, `delete from app.${table}`, `truncate app.${table} cascade`])
        await expect(tx.savepoint(sp => sp.unsafe(statement))).rejects.toThrow("append-only");
    });
  });
  it("refuses direct approval, preserves AI output, and refuses publication", async () => {
    await inFixture(async (tx, f) => {
      await tx`set local role suhail_app`;
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("transition");
      await generated(tx, f.draft);
      await expect(tx.savepoint(sp => sp`update app.research_draft set ai_output='{}' where id=${f.draft}`)).rejects.toThrow("immutable");
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='published' where id=${f.draft}`)).rejects.toThrow("unavailable");
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("six review");
    });
  });
  it("requires validation for exactly the current text hash and refuses open blocks", async () => {
    await inFixture(async (tx, f) => {
      await generated(tx, f.draft); await review(tx, f.draft, f.actor);
      await tx`update app.research_draft set validation_results='[{"severity":"block"}]' where id=${f.draft}`;
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("blocking");
      await tx`update app.research_draft set validation_results='[]',validation_text_hash='old-hash' where id=${f.draft}`;
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("blocking");
    });
  });
  it("requires an active analyst with six true answers and can approve without publishing", async () => {
    await inFixture(async (tx, f) => {
      await generated(tx, f.draft);
      await review(tx, f.draft, f.actor, { ...Object.fromEntries(CHECKLIST.map(k => [k, true])), figures_checked: false });
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("six review");
      await review(tx, f.draft, f.actor);
      await tx`update app.analyst_profile set active=false where user_id=${f.actor}`;
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='approved' where id=${f.draft}`)).rejects.toThrow("six review");
      await tx`update app.analyst_profile set active=true where user_id=${f.actor}`;
      await tx`update app.research_draft set state='approved' where id=${f.draft}`;
      expect((await tx`select state from app.research_draft where id=${f.draft}`)[0].state).toBe("approved");
      await expect(tx.savepoint(sp => sp`update app.research_draft set state='published' where id=${f.draft}`)).rejects.toThrow("unavailable");
    });
  });
  it("enforces gate evidence and starts with the gate and budgets off", async () => {
    await inFixture(async tx => {
      const [settings] = await tx`select * from app.research_setting where id=1`;
      expect(settings.ai_research_publishing).toBe(false);
      expect(Number(settings.monthly_token_budget)).toBe(0);
      expect(settings).toMatchObject({ allowed_sectors: [], max_active_research_stocks: 0,
        price_move_threshold_percent: null, publication_age_days: null,
        gate_decision_id: null, gate_lawyer_answer_ref: null, gate_enabled_at: null, gate_enabled_by: null });
      await expect(tx.savepoint(sp => sp`update app.research_setting set ai_research_publishing=true where id=1`)).rejects.toThrow("research_gate_evidence");
      await tx`update app.research_setting set ai_research_publishing=true,gate_decision_id='D-216',
        gate_lawyer_answer_ref='synthetic test only',gate_enabled_by=${randomUUID()},gate_enabled_at=now() where id=1`;
      const publicTables = await tx`select tablename from pg_tables where schemaname='app' and tablename='research_publication'`;
      expect(publicTables).toHaveLength(0);
    });
  });
  it("reserves tokens atomically and refuses a request beyond the monthly cap", async () => {
    await inFixture(async tx => {
      await tx`update app.research_setting set monthly_token_budget=100 where id=1`;
      await tx`insert into app.research_usage(month) values('2099-01-01')`;
      const first = await tx`update app.research_usage set reserved=reserved+60 where month='2099-01-01'
        and used+reserved+60 <= (select monthly_token_budget from app.research_setting where id=1) returning *`;
      expect(first).toHaveLength(1);
      const second = await tx`update app.research_usage set reserved=reserved+60 where month='2099-01-01'
        and used+reserved+60 <= (select monthly_token_budget from app.research_setting where id=1) returning *`;
      expect(second).toHaveLength(0);
      await tx`update app.research_usage set reserved=reserved-60,used=used+25 where month='2099-01-01'`;
      const [usage] = await tx`select used,reserved from app.research_usage where month='2099-01-01'`;
      expect(Number(usage.used)).toBe(25); expect(Number(usage.reserved)).toBe(0);
    });
  });
  it("rolls back the review event and audit event together", async () => {
    const { recordResearch } = await import("../src/lib/research/store");
    const actor = { id: randomUUID(), email: null, role: "admin" as const, full_name: "Synthetic fixture" };
    // Historical actor IDs intentionally have no mutable-user FK (D-17/D-76).
    try {
      await drizzle(db, { schema }).transaction(async tx => {
        await tx.execute(query`set local role suhail_app`);
        await recordResearch(tx, actor as Parameters<typeof recordResearch>[1], "research_settings", null, null, null, null);
        const counts = await tx.execute(query`select
          (select count(*) from app.research_review_event where actor_id=${actor.id})::int reviews,
          (select count(*) from app.audit_event where actor_id=${actor.id} and event_type='research_settings')::int audits`);
        expect(counts[0]).toEqual({ reviews: 1, audits: 1 });
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    const [counts] = await db`select
      (select count(*) from app.research_review_event where actor_id=${actor.id})::int reviews,
      (select count(*) from app.audit_event where actor_id=${actor.id})::int audits`;
    expect(counts).toEqual({ reviews: 0, audits: 0 });
  });
});
