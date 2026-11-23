import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import type { Sql } from "postgres";
import * as schema from "../src/db/schema";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import type { AppUser, Tx } from "../src/lib/auth/audit";
import { runResearchStaleness } from "../src/lib/research/staleness-job";
import { clearAnalystViewReview, readApprovedAnalystView, researchRefreshQueue } from "../src/lib/research/stale-store";
import { createRefreshRequest } from "../src/lib/research/refresh";
import { activeResearchStocks, createRequestedDraft, reconcileRequestedDraft, reserveDraftBudget, saveResearchGeneration, settleDraftBudget } from "../src/lib/research/store";
import { generateResearch } from "../src/lib/research/generate";
import { RecordedResearchClient } from "../src/lib/research/recorded-client";
import { assembleDraft } from "../src/ai/research/draft";
import { buildResearchPacket } from "../src/ai/research/packet";
import { CHECKLIST } from "../src/lib/research/contracts";
import { fixtureInput, FIXTURE_CLOCK } from "./fixtures/research/packets";
import { handwrittenModel } from "./fixtures/research/outputs";

vi.mock("server-only", () => ({}));
let db: Sql;
const rollback = new Error("rollback P3 fixture");
beforeAll(async () => { db = cliConnection("DATABASE_URL_TEST"); await applyMigrations(db); });
afterAll(async () => { await db?.end(); });
const now = new Date("2027-02-02T12:00:00Z");

async function fixture(tx: Tx) {
  const actor = { id: randomUUID(), email: null, role: "admin" } as AppUser;
  const company = randomUUID(), stock = randomUUID(), draft = randomUUID();
  const source = randomUUID(), method = randomUUID(), version = randomUUID();
  const impact = randomUUID(), testReport = randomUUID(), approval = randomUUID(), analyst = randomUUID();
  await tx.execute(sql`insert into app.users(id,full_name,role,is_demo) values(${actor.id},'Fixture analyst','admin',false)`);
  await tx.execute(sql`insert into app.analyst_profile(id,user_id,name_ar,active,is_demo) values(${analyst},${actor.id},'Fixture only',true,false)`);
  await tx.execute(sql`insert into app.company(id,name,sector_label,is_demo) values(${company},'Fixture company','Technology',false)`);
  await tx.execute(sql`insert into app.security(id,company_id,ticker,slug,is_demo,in_universe,coverage_analyst_id)
    values(${stock},${company},'SYN',${"syn-" + stock},false,true,${analyst})`);
  await tx.execute(sql`insert into app.source(id,label,source_type,document_title,source_url,is_synthetic,is_demo)
    values (${source},'Fixture only','methodology_document','Fixture document','https://fixture.invalid/rules',false,false)`);
  await tx.execute(sql`insert into app.methodology(id,name,slug,official_or_inspired,source_title,source_url,verified_by,verification_date)
    values (${method},'Fixture methodology','fixture-method','official','Fixture document','https://fixture.invalid/rules','fixture','2026-10-01')`);
  await tx.execute(sql`insert into app.methodology_version(id,methodology_id,version,version_label,effective_date,source_ids,is_public)
    values (${version},${method},'1','Fixture version','2026-01-01',ARRAY[${source}]::uuid[],true)`);
  await tx.execute(sql`insert into app.methodology_version_report(id,methodology_version_id,kind,payload)
    values (${impact},${version},'impact','{}'),(${testReport},${version},'test','{}')`);
  await tx.execute(sql`insert into app.audit_event(id,event_type,entity_name,entity_id,actor_id,summary)
    values (${approval},'approval_recorded','methodology_version',${version},${actor.id},'Fixture only')`);
  await tx.execute(sql`insert into app.methodology_criterion(methodology_version_id,criterion_type,label)
    values (${version},'business_activity','Fixture criterion')`);
  await tx.execute(sql`update app.methodology_version set impact_report_id=${impact},test_report_id=${testReport},
    approval_id=${approval},approved_by=${actor.id},approved_at=now(),workflow_status='approved' where id=${version}`);
  await tx.execute(sql`update app.methodology set production_enabled=true where id=${method}`);
  await tx.execute(sql`update app.methodology_version set production_enabled=true where id=${version}`);
  await tx.execute(sql`insert into app.editorial_setting(setting_key,default_shariah_methodology_version_id)
    values('editorial',${version}) on conflict(setting_key) do update set default_shariah_methodology_version_id=excluded.default_shariah_methodology_version_id`);
  const rows = fixtureInput();
  rows.security.id = stock;
  rows.runs[0].status = "passes_selected_methodology";
  const packet = buildResearchPacket(rows, FIXTURE_CLOCK);
  const output = assembleDraft(handwrittenModel(packet), packet);
  const [stored] = await tx.insert(schema.researchPacket).values({ security_id: stock, packet_hash: packet.packet_hash,
    packet_schema_version: packet.packet_schema_version, built_at: new Date(FIXTURE_CLOCK), payload: packet }).returning();
  await tx.insert(schema.researchDraft).values({ id: draft, security_id: stock, packet_id: stored.id,
    prompt_version: "fixture", validator_version: "fixture", validation_results: [] });
  await tx.update(schema.researchDraft).set({ state: "generated", ai_output: output, analyst_text: output,
    text_hash: "current", validation_text_hash: "current" }).where(eq(schema.researchDraft.id, draft));
  await tx.update(schema.researchDraft).set({ state: "in_review" }).where(eq(schema.researchDraft.id, draft));
  await tx.insert(schema.researchReviewEvent).values({ draft_id: draft, actor_id: actor.id, actor_role: "admin",
    to_state: "approved", text_hash: "current", checklist: Object.fromEntries(CHECKLIST.map(k => [k, true])) as Record<typeof CHECKLIST[number], boolean>,
    prompt_version: "fixture", validator_version: "fixture", occurred_at: new Date("2026-11-02T12:00:00Z") });
  await tx.update(schema.researchDraft).set({ state: "approved" }).where(eq(schema.researchDraft.id, draft));
  await tx.update(schema.researchSetting).set({ monthly_token_budget: 100, max_active_research_stocks: 1,
    allowed_sectors: [{ sector: "Technology", limit: 1 }], price_move_threshold_percent: "10", publication_age_days: 90,
    max_packet_age_days: 30, max_financial_age_days: 550 });
  await storeRun(tx, stock, version, "passes_selected_methodology", rows.runs[0].run_at, rows.runs[0].immutable_hash);
  return { actor, stock, version, company, source, draft, rows, packet, output };
}
async function storeRun(tx: Tx, stock: string, version: string, status: string, date: string, hash: string) {
  const id = randomUUID();
  await tx.execute(sql`insert into app.screening_run(id,security_id,methodology_version_id,status,hash_payload,immutable_hash,generated_at,is_demo)
    values(${id},${stock},${version},${status}::app.screening_status,'{}',${hash},${date}::timestamptz,false)`);
  return id;
}
async function run(work: (tx: Tx, f: Awaited<ReturnType<typeof fixture>>) => Promise<void>) {
  try { await drizzle(db, { schema }).transaction(async tx => { await work(tx, await fixture(tx)); throw rollback; }); }
  catch (error) { if (error !== rollback) throw error; }
}

describe("P3 private research flags and refreshes in PostgreSQL", () => {
  it.each(["research_staleness_event", "research_refresh"])("protects %s with RLS and only app select/insert privileges", async table => {
    const [row] = await db`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='app' and c.relname=${table}`;
    expect(row.relrowsecurity).toBe(true);
    for (const permission of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
      const [grant] = await db`select has_table_privilege('suhail_public',${"app." + table},${permission}) as public,
        has_table_privilege('suhail_app',${"app." + table},${permission}) as app`;
      expect(grant).toEqual({ public: false, app: ["SELECT", "INSERT"].includes(permission) });
    }
  });
  it("records a quarterly filing, run change, price move and age once, with an atomic audit and append-only guard", async () => {
    await run(async (tx, f) => {
      await tx.execute(sql`insert into app.financial_period(company_id,period_type,fiscal_period_label,period_end,reported_date,source_id)
        values(${f.company},'quarterly','Fixture Q3','2026-09-30','2026-10-01',${f.source})`);
      await tx.execute(sql`insert into app.price_bar(security_id,date,month_end_for,close,currency,source_id,is_synthetic,is_demo)
        values(${f.stock},'2027-01-29','2027-01-31',${2 * f.rows.prices[0].close},'USD',${f.source},false,false)`);
      await storeRun(tx, f.stock, f.version, "fails_selected_methodology", "2027-01-01T00:00:00Z", "updated-hash");
      await tx.execute(sql`set local role suhail_app`);
      expect(await runResearchStaleness(now, tx)).toEqual({ inspected: 1, updated: 1 });
      expect(await runResearchStaleness(now, tx)).toEqual({ inspected: 1, updated: 0 });
      const reasons = ["new_filing", "status_changed", "price_moved", "aged"];
      expect(await researchRefreshQueue(tx)).toEqual([{ id: f.draft, ticker: "SYN", reasons, review_required: true, refresh_in_progress: false }]);
      const events = await tx.select().from(schema.researchStalenessEvent);
      expect(events).toHaveLength(1);
      const audits = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.event_type, "research_staleness"));
      expect(audits).toHaveLength(1);
      expect(audits[0].details).toMatchObject({ before: { outdated: false, analyst_view_review_required: false },
        after: { outdated: true, outdated_reasons: reasons, analyst_view_review_required: true } });
      await tx.execute(sql`reset role`);
      const immutable = { cause: expect.objectContaining({ message: expect.stringContaining("append-only") }) };
      await expect(tx.transaction(sp => sp.execute(sql`update app.research_staleness_event set outdated=true`))).rejects.toMatchObject(immutable);
      await expect(tx.transaction(sp => sp.execute(sql`truncate app.research_staleness_event`))).rejects.toMatchObject(immutable);
    });
  });
  it("hides on a failed default result before the job, stays hidden on recovery, and clears only after an active analyst confirms the current run", async () => {
    await run(async (tx, f) => {
      expect(await readApprovedAnalystView(f.draft, tx)).toMatchObject({ analyst_view: f.output.analyst_view });
      const fail = await storeRun(tx, f.stock, f.version, "fails_selected_methodology", "2026-11-03T00:00:00Z", "fail");
      expect(await readApprovedAnalystView(f.draft, tx)).toMatchObject({ analyst_view: null, clear_run_id: null });
      expect(await tx.select().from(schema.researchStalenessEvent)).toHaveLength(0);
      const pass = await storeRun(tx, f.stock, f.version, "passes_selected_methodology", "2026-11-04T00:00:00Z", "pass");
      await tx.execute(sql`set local role suhail_app`);
      expect(await readApprovedAnalystView(f.draft, tx)).toMatchObject({ analyst_view: null, clear_run_id: pass });
      await expect(clearAnalystViewReview(tx, { ...f.actor, id: randomUUID() }, f.draft, pass)).rejects.toThrow(/active analyst/);
      await expect(clearAnalystViewReview(tx, f.actor, f.draft, fail)).rejects.toThrow(/current passing/);
      expect(await clearAnalystViewReview(tx, f.actor, f.draft, pass)).toBe(true);
      expect(await readApprovedAnalystView(f.draft, tx)).toMatchObject({ analyst_view: f.output.analyst_view, analyst_view_review_required: false });
      expect(await clearAnalystViewReview(tx, f.actor, f.draft, pass)).toBe(false);
      const [audit] = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.event_type, "research_staleness"));
      expect(audit.details).toMatchObject({ after: { cleared_stop_id: fail, cleared_version_id: f.version } });
    });
  });
  it("refuses a regular or refresh draft with empty sectors or zero budget before recording a new request", async () => {
    await run(async (tx, f) => {
      await tx.execute(sql`set local role suhail_app`);
      expect(await runResearchStaleness(now, tx)).toEqual({ inspected: 1, updated: 1 });
      const revised = buildResearchPacket(f.rows, now.toISOString());
      for (const configure of [
        { allowed_sectors: [], monthly_token_budget: 100, reason: /sector is not allowed/i },
        { allowed_sectors: [{ sector: "Technology", limit: 1 }], monthly_token_budget: 0, reason: /budget is not configured/i },
      ]) {
        await tx.update(schema.researchSetting).set({ allowed_sectors: configure.allowed_sectors, monthly_token_budget: configure.monthly_token_budget });
        await expect(createRequestedDraft(tx, f.actor, revised, "", null)).rejects.toThrow(configure.reason);
        await expect(createRefreshRequest(tx, f.actor, revised, f.draft)).rejects.toThrow(configure.reason);
      }
      expect(await tx.select().from(schema.researchDraft)).toHaveLength(1);
      expect(await tx.select().from(schema.researchUsage)).toHaveLength(0);
    });
  });
  it("uses the shared budget, counts one active stock, and reconciles and retries an orphan refresh", async () => {
    await run(async (tx, f) => {
      const other = randomUUID();
      await tx.execute(sql`insert into app.security(id,company_id,ticker,slug,is_demo,in_universe,coverage_analyst_id)
        select ${other},company_id,'SYNOTHER',${"syn-" + other},false,true,coverage_analyst_id from app.security where id=${f.stock}`);
      await tx.execute(sql`set local role suhail_app`);
      expect(await runResearchStaleness(now, tx)).toEqual({ inspected: 1, updated: 1 });
      const revised = buildResearchPacket(f.rows, now.toISOString());
      const created = await createRefreshRequest(tx, f.actor, revised, f.draft);
      expect(created.draft.previous_draft_id).toBe(f.draft);
      expect(created.refresh.changes).toEqual([expect.objectContaining({ item_id: "packet.age", trigger: "age" })]);
      expect((await researchRefreshQueue(tx))[0].refresh_in_progress).toBe(true);
      expect(new Set((await activeResearchStocks(tx)).map(row => row.security_id)).size).toBe(1);
      const otherPacket = buildResearchPacket({ ...f.rows, security: { ...f.rows.security, id: other } }, now.toISOString());
      await expect(createRequestedDraft(tx, f.actor, otherPacket, "", null)).rejects.toThrow(/active research stock limit/i);
      await expect(createRefreshRequest(tx, f.actor, revised, f.draft)).rejects.toThrow(/already in progress/);
      expect(await reserveDraftBudget(tx, f.actor, created.draft.id, "2099-01-01", 101)).toBeNull();
      expect(await reserveDraftBudget(tx, f.actor, created.draft.id, "2099-01-01", 100)).toBe(1);
      await reconcileRequestedDraft(tx, f.actor, created.draft.id);
      const [orphan] = await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, created.draft.id));
      expect(orphan).toMatchObject({ state: "failed", failure_reason: "abandoned", reserved_tokens: 0 });
      const [month] = await tx.select().from(schema.researchUsage).where(eq(schema.researchUsage.month, "2099-01-01"));
      expect(month.reserved).toBe(0);
      const retry = await createRefreshRequest(tx, f.actor, revised, f.draft);
      const text = JSON.stringify(handwrittenModel(revised));
      const result = await generateResearch(new RecordedResearchClient([{ text, model: "fixture", model_version: "recorded",
        stop_reason: "end_turn", input_tokens: 20, output_tokens: 15 }]), {
        packet: revised, refresh: retry.refresh, guidance: "", max_input_tokens: 60, max_output_tokens: 40,
      }, {
        reserve: async amount => await reserveDraftBudget(tx, f.actor, retry.draft.id, "2099-01-01", amount) !== null,
        settle: async (amount, used) => { await settleDraftBudget(tx, f.actor, retry.draft.id, 1, amount, used); },
      }, { now: now.toISOString(), max_packet_age_days: 30, max_financial_age_days: 550, known_issuers: [] });
      expect(result).toMatchObject({ state: "generated", attempts: 1, input_tokens: 20, output_tokens: 15, issues: [] });
      await saveResearchGeneration(tx, f.actor, retry.draft.id, result);
      const [generated] = await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, retry.draft.id));
      expect(generated).toMatchObject({ state: "generated", ai_output: result.draft, previous_draft_id: f.draft, reserved_tokens: 0 });
      const audits = await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.event_type, "research_refresh_requested"));
      expect(audits).toHaveLength(2);
      expect(audits[0].details).toMatchObject({ before: { approved_draft_id: f.draft, refresh_draft_id: null },
        after: { approved_draft_id: f.draft, state: "requested", change_count: 1 } });
      await tx.execute(sql`reset role`);
      await expect(tx.transaction(sp => sp.execute(sql`delete from app.research_refresh`))).rejects.toMatchObject({
        cause: expect.objectContaining({ message: expect.stringContaining("append-only") }),
      });
    });
  });
});

describe("P4 publication database boundary", () => {
  const display = JSON.stringify({
    plain_summary: Array.from({ length: 3 }, () => ({ en: "Synthetic evidence summary", ar: "Synthetic evidence summary" })),
    analyst_view: { thesis: [{ en: "Synthetic thesis", ar: "Synthetic thesis", packet_hash: "Private fixture sentinel" }],
      evidence: [], risks: [], valuation: { en: "Synthetic", ar: "Synthetic" } },
    methodologies: [{ slug: "fixture-method", label: "Fixture methodology", status: "passes_selected_methodology" }],
    citations: [], never_public: "Private fixture sentinel",
  });
  async function gate(tx: Tx, actor: string, on: boolean) {
    await tx.execute(sql`update app.research_setting set ai_research_publishing=${on},
      gate_decision_id=${on ? "D-223" : null},gate_lawyer_answer_ref=${on ? "Disposable test only" : null},
      gate_enabled_by=${on ? actor : null},gate_enabled_at=case when ${on} then now() else null end,
      max_packet_age_days=36500,max_financial_age_days=36500 where id=1`);
  }
  function transition(tx: Tx, actor: string, draft: string, kind: string, reason: string | null = null) {
    return tx.execute(sql`insert into app.research_publication_event(draft_id,actor_id,kind,display,withdrawal_reason)
      values (${draft},${actor},${kind},${display}::jsonb,${reason})`).catch(error => { throw error.cause ?? error; });
  }
  async function read(tx: Tx, stock: string) {
    await tx.execute(sql`set local role suhail_public`);
    const rows = await tx.execute(sql`select * from app.public_stock_research where slug=${"syn-" + stock}`);
    await tx.execute(sql`reset role`);
    return rows;
  }
  it("guards event inserts, grants only the public projection, and hides the analyst view across a stop and recovery", async () => {
    await run(async (tx, f) => {
      await expect(tx.transaction(t => transition(t, f.actor.id, f.draft, "published"))).rejects.toThrow(/gate is off/);
      await gate(tx, f.actor.id, true);
      await expect(tx.transaction(t => transition(t, randomUUID(), f.draft, "published"))).rejects.toThrow(/active analyst administrator/);
      await tx.transaction(async t => {
        // Emulate a malformed legacy row. An ordinary UPDATE cannot add a block
        // to an approved draft (the prior trigger independently refuses it).
        await t.execute(sql`alter table app.research_draft disable trigger research_draft_transitions`);
        await t.execute(sql`update app.research_draft set validation_results='[{"severity":"block"}]' where id=${f.draft}`);
        await expect(t.transaction(inner => transition(inner, f.actor.id, f.draft, "published"))).rejects.toThrow(/blocking checks/);
        throw rollback;
      }).catch(e => { if (e !== rollback) throw e; });
      await tx.transaction(async t => {
        await t.execute(sql`insert into app.research_staleness_event(draft_id,outdated,outdated_reasons,analyst_view_review_required)
          values(${f.draft},true,array['aged'],false)`);
        await expect(t.transaction(inner => transition(inner, f.actor.id, f.draft, "published"))).rejects.toThrow(/outdated/);
        throw rollback;
      }).catch(e => { if (e !== rollback) throw e; });
      await tx.execute(sql`set local role suhail_app`);
      await transition(tx, f.actor.id, f.draft, "published");
      await tx.execute(sql`reset role`);
      const [first] = await read(tx, f.stock);
      expect(first.analyst_view).not.toBeNull();
      expect(Object.keys(first).sort()).toEqual([
        "analyst_view", "approval_at", "bio_ar", "bio_en", "citations", "credentials", "data_as_of", "headshot_object_key",
        "methodologies", "name_ar", "name_en", "outdated_at", "outdated_codes", "plain_summary", "slug", "title_ar", "title_en",
        "update_codes", "updated_at",
      ].sort());
      expect(JSON.stringify(first)).not.toContain("Private fixture sentinel");
      await gate(tx, f.actor.id, false);
      expect(await read(tx, f.stock)).toEqual([]);
      await gate(tx, f.actor.id, true);
      await tx.execute(sql`update app.analyst_profile set active=false where user_id=${f.actor.id}`);
      expect(await read(tx, f.stock)).toEqual([]);
      await tx.execute(sql`update app.analyst_profile set active=true where user_id=${f.actor.id}`);
      await storeRun(tx, f.stock, f.version, "requires_review", "2026-12-01T12:00:00Z", "p4-stop");
      expect((await read(tx, f.stock))[0].analyst_view).toBeNull();
      const passing = await storeRun(tx, f.stock, f.version, "passes_selected_methodology", "2026-12-02T12:00:00Z", "p4-pass");
      expect((await read(tx, f.stock))[0].analyst_view).toBeNull();
      await clearAnalystViewReview(tx, f.actor, f.draft, passing);
      expect((await read(tx, f.stock))[0].analyst_view).not.toBeNull();
      await tx.execute(sql`set local role suhail_public`);
      await expect(tx.transaction(t => t.execute(sql`select * from app.research_publication_event`)
        .catch(error => { throw error.cause ?? error; }))).rejects.toThrow(/permission denied/);
      await tx.execute(sql`reset role`);
      await expect(tx.transaction(t => t.execute(sql`delete from app.research_publication_event`)
        .catch(error => { throw error.cause ?? error; }))).rejects.toThrow(/append-only/);
    });
  });
  it("supersedes only with a linked approved refresh and retains the initial, update and withdrawal events", async () => {
    await run(async (tx, f) => {
      await gate(tx, f.actor.id, true);
      await transition(tx, f.actor.id, f.draft, "published");
      await expect(tx.transaction(t => transition(t, f.actor.id, f.draft, "updated"))).rejects.toThrow(/approved refresh/);
      const id = randomUUID();
      const [parent] = await tx.select().from(schema.researchDraft).where(eq(schema.researchDraft.id, f.draft));
      await tx.insert(schema.researchDraft).values({ id, previous_draft_id: parent.id, security_id: f.stock, packet_id: parent.packet_id,
        prompt_version: "fixture", validator_version: "fixture", validation_results: [] });
      await tx.update(schema.researchDraft).set({ state: "generated", ai_output: f.output, analyst_text: f.output,
        text_hash: "refresh", validation_text_hash: "refresh" }).where(eq(schema.researchDraft.id, id));
      await tx.update(schema.researchDraft).set({ state: "in_review" }).where(eq(schema.researchDraft.id, id));
      await expect(tx.transaction(t => transition(t, f.actor.id, id, "updated"))).rejects.toThrow(/approved draft/);
      await tx.insert(schema.researchReviewEvent).values({ draft_id: id, actor_id: f.actor.id, actor_role: "admin", to_state: "approved",
        text_hash: "refresh", prompt_version: "fixture", validator_version: "fixture",
        checklist: Object.fromEntries(CHECKLIST.map(key => [key, true])) as typeof schema.researchReviewEvent.$inferInsert["checklist"] });
      await tx.update(schema.researchDraft).set({ state: "approved" }).where(eq(schema.researchDraft.id, id));
      await tx.execute(sql`insert into app.research_refresh(draft_id,changes) values(${id},'[{"trigger":"new_filing"}]'::jsonb)`);
      await transition(tx, f.actor.id, id, "updated");
      expect((await read(tx, f.stock))[0]).toMatchObject({ update_codes: ["new_filing"], updated_at: expect.anything() });
      await transition(tx, f.actor.id, id, "withdrawn", "evidence_corrected");
      expect(await read(tx, f.stock)).toEqual([]);
      expect((await tx.execute(sql`select kind from app.research_publication_event where security_id=${f.stock} order by id`))
        .map(row => row.kind)).toEqual(["published", "updated", "withdrawn"]);
    });
  });
});
