import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { cliConnection } from "../scripts/db/connection";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDemoData } from "../scripts/db/seed-demo";
import * as schema from "../src/db/schema";
import { loadPublicHome } from "../src/db/home-public";
import type { dbPublic } from "../src/db/public";
import { mutateSettings } from "../src/lib/auth/admin-mutations";
vi.mock("server-only",()=>({}));
const client=cliConnection("DATABASE_URL_TEST");
const database=drizzle(client,{schema});
beforeAll(async()=>{
  vi.stubEnv("SITE_URL","https://fixture.invalid");vi.stubEnv("SITE_MODE","preview");
  // Synthetic EX-A fixtures must opt in; demo content is hidden on every deployment.
  vi.stubEnv("PUBLIC_DEMO_FIXTURES","1");
  await applyMigrations(client);await seedDemoData(client);
},30_000);
afterAll(async()=>{vi.unstubAllEnvs();await client.end({timeout:1});});
type Tx=Parameters<Parameters<typeof database.transaction>[0]>[0];
async function isolated(work:(tx:Tx)=>Promise<void>) {
  const rollback=Symbol("rollback");
  try {await database.transaction(async tx=>{await work(tx);throw rollback;});}
  catch(error){if(error!==rollback)throw error;}
}
const publicDb=(tx:Tx)=>tx as unknown as typeof dbPublic;
async function fixture(tx:Tx) {
  const [security]=await tx.select().from(schema.security).where(eq(schema.security.slug,"demo-fixa"));
  const [setting]=await tx.select().from(schema.editorialSetting);
  return {security,setting};
}
describe("UX-6 public homepage and audited selection",()=>{
  it("migration leaves the selected feature empty and denies private settings",()=>isolated(async tx=>{
    await tx.execute(sql`set local role suhail_public`);
    const [settings]=await tx.execute(sql`select * from app.public_settings`);
    expect(Object.keys(settings).sort()).toEqual(["default_shariah_methodology_version_id","featured_security_id"]);
    expect(settings.featured_security_id).toBeNull();
    await expect(tx.transaction(nested=>nested.execute(sql`select notes from app.editorial_setting`))).rejects.toThrow();
    expect((await loadPublicHome(publicDb(tx))).featured).toBeNull();
  }));
  it("requires a selected security and a run under the current public default",()=>isolated(async tx=>{
    const {security,setting}=await fixture(tx);
    await tx.update(schema.editorialSetting).set({featured_security_id:security.id}).where(eq(schema.editorialSetting.id,setting.id));
    await tx.execute(sql`set local role suhail_public`);
    const home=await loadPublicHome(publicDb(tx));
    expect(home.featured?.security.slug).toBe("demo-fixa");
    expect(home.featured?.run?.status).toBe("passes_selected_methodology");
    expect(home.methodology?.name).toBe(home.featured?.methodology?.name);
    expect(JSON.stringify(home)).not.toMatch(/hash_payload|editor_author_email/);
  }));
  it("shows no demo methodology, card or editor pick on preview deployments without the fixture opt-in",()=>isolated(async tx=>{
    const {security,setting}=await fixture(tx);
    await tx.update(schema.editorialSetting).set({featured_security_id:security.id}).where(eq(schema.editorialSetting.id,setting.id));
    await tx.execute(sql`set local role suhail_public`);
    try {
      vi.stubEnv("PUBLIC_DEMO_FIXTURES","");
      const home=await loadPublicHome(publicDb(tx));
      expect(home).toEqual({featured:null,methodology:null,editorPick:null});
    } finally { vi.stubEnv("PUBLIC_DEMO_FIXTURES","1"); }
  }));
  it.each(["no-default","no-run","hidden"] as const)("hides invalid feature state: %s",state=>isolated(async tx=>{
    const {security,setting}=await fixture(tx);
    let selectedId=security.id;
    if(state==="no-run"||state==="hidden"){
      const [other]=await tx.select().from(schema.security).where(eq(schema.security.slug,state==="no-run"?"demo-new":"demo-hidden"));
      selectedId=other.id;
    }
    await tx.update(schema.editorialSetting).set({
      featured_security_id:selectedId,
      ...(state==="no-default"?{default_shariah_methodology_version_id:null}:{}),
    }).where(eq(schema.editorialSetting.id,setting.id));
    await tx.execute(sql`set local role suhail_public`);
    const home=await loadPublicHome(publicDb(tx));
    expect(home.featured).toBeNull();
    if(state==="no-default")expect(home.methodology).toBeNull();
  }));
  it("records selection, clearing and rejects malformed/missing/hidden slugs without writes",()=>isolated(async tx=>{
    const {security,setting}=await fixture(tx);
    const [actor]=await tx.insert(schema.users).values({id:randomUUID(),full_name:"Fixture Admin",email:"fixture@example.invalid",role:"admin"}).returning();
    const actorIdentity={...actor,email:actor.email!};
    const before=(await tx.select().from(schema.auditEvent)).length;
    for(const slug of ["missing-slug","bad/slash","demo-hidden"]) {
      await expect(mutateSettings(tx,actorIdentity,setting.default_shariah_methodology_version_id,setting.allow_ineligible_editor_pick,slug)).rejects.toThrow();
    }
    expect((await tx.select().from(schema.auditEvent)).length).toBe(before);
    expect(await mutateSettings(tx,actorIdentity,setting.default_shariah_methodology_version_id,setting.allow_ineligible_editor_pick,security.slug)).toBe(true);
    expect(await mutateSettings(tx,actorIdentity,setting.default_shariah_methodology_version_id,setting.allow_ineligible_editor_pick,security.slug)).toBe(false);
    expect(await mutateSettings(tx,actorIdentity,setting.default_shariah_methodology_version_id,setting.allow_ineligible_editor_pick,null)).toBe(true);
    const events=await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.entity_id,setting.id));
    expect(events.map(event=>event.details)).toEqual([
      {key:"featured_security_id",before:null,after:security.id},
      {key:"featured_security_id",before:security.id,after:null},
    ]);
  }));
  it.each([false,true])("latest published editor slot, with actual author profile active=%s",active=>isolated(async tx=>{
    const {security}=await fixture(tx);
    const [author]=await tx.insert(schema.users).values({id:randomUUID(),full_name:"Fixture Author",email:"private-author@example.invalid",role:"editor"}).returning();
    await tx.insert(schema.analystProfile).values({user_id:author.id,name_ar:"Fixture author",name_en:"Fixture author EN",active,credentials:"CFA"});
    const [publication]=await tx.insert(schema.edition).values({edition_id:`HOME-${randomUUID()}`,week_start:"2026-10-12",week_end:"2026-10-18",
      status:"published_demo",published_at:new Date(),is_demo:true}).returning();
    const payload={edition_id:publication.id,security_id:security.id,pick_type:"editor" as const,slot_key:"editor",created_by:null,
      editor_author_email:author.email,
      editor_thesis_ar:"التوافق ليس توصية.",editor_thesis_en:"Published editor thesis.",editor_why_now_ar:"من الإفصاح إلى النتيجة.",
      editor_valuation_context_ar:"ثلاث نتائج، لا اثنتان.",editor_conflict_disclosure_ar:"سجل فحص لا يُعدَّل",risks_ar:[],is_demo:true};
    await tx.insert(schema.pick).values(payload);
    const [draft]=await tx.insert(schema.edition).values({edition_id:`DRAFT-${randomUUID()}`,week_start:"2026-10-19",week_end:"2026-10-25",status:"draft",is_demo:true}).returning();
    await tx.insert(schema.pick).values({...payload,edition_id:draft.id,editor_thesis_en:"Private draft decoy."});
    // A newer AI slot must not substitute for the Editor's Pick.
    await tx.insert(schema.pick).values({...payload,pick_type:"ai",slot_key:"ai",editor_thesis_en:"AI decoy."});
    await tx.execute(sql`set local role suhail_public`);
    const home=await loadPublicHome(publicDb(tx));
    expect(home.editorPick?.thesis_en).toBe("Published editor thesis.");
    expect(home.editorPick?.analyst?.name_en??null).toBe(active?"Fixture author EN":null);
    expect(JSON.stringify(home)).not.toMatch(/private-author|Private draft|AI decoy/);
    await expect(tx.transaction(nested=>nested.execute(sql`select user_id from app.analyst_profile`))).rejects.toThrow();
    await expect(tx.transaction(nested=>nested.execute(sql`select created_by from app.pick`))).rejects.toThrow();
  }));
});
