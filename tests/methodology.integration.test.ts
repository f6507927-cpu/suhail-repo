import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import type { Tx, AppUser } from "../src/lib/auth/audit";
const boundary=vi.hoisted(()=>({db:undefined as unknown as typeof import("../src/db/app").dbApp,publicDb:undefined as unknown as typeof import("../src/db/public").dbPublic,role:"admin",id:"",guard:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("../src/db/app",()=>({get dbApp(){return boundary.db;}}));
vi.mock("../src/db/public",()=>({get dbPublic(){return boundary.publicDb;}}));
vi.mock("../src/lib/auth/guards",()=>({requireRole:async(roles:string[])=>{
  boundary.guard(roles);
  if(!roles.includes(boundary.role)) throw new Error("role_required");
  return {identity:{id:boundary.id}};
}}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import * as service from "../src/lib/methodology/service";
import { methodologyAction } from "../src/app/[locale]/(private)/admin/(protected)/methodology-actions";
import { readMethodologies } from "../src/lib/methodology/admin-data";
import { getPublicMethodology } from "../src/db/methodology-public";
let owner:Sql,app:Sql,pub:Sql,control:Sql;
const database=`methodology_${randomUUID().replaceAll("-","")}`;
const rollback=new Error("rollback only");
const metadata={name:"Non-demo local test",slug:"local-test",short_label:"Local",type:"equity_screening",
  publisher:"Test publisher",source_title:"Test document",source_url:"https://document.invalid/rules",
  official_or_inspired:"official",licensing_status:"public_document",verified_by:"Test verifier",
  verification_date:"2026-10-14",scope:"Local rollback fixture",notes:null};
const content={version:"1",version_label:"Local v1",effective_date:"2026-01-01",changelog:"Test",notes:null,purification_treatment:null,is_public:false};
const rule={criterion_type:"custom_ratio",label:"Local debt",definition:"Test",formula_text:"debt/assets",
  numerator_definition:"Debt",denominator_definition:"Assets",numerator_line_items:["interest_bearing_debt"],
  denominator_line_items:["total_assets"],threshold:33,threshold_unit:"percent_of_total_assets",
  threshold_direction:"max",borderline_margin:null,treatment_rules:null,treatment_rule_data:null,
  edge_cases:null,source_reference:"Test document",effective_date:"2026-01-01",sort_order:0,notes:null};
function cases(id:string) {
  return [20,60].map((value,index)=>({name:index?"fails":"passes",inputs:{
    securityId:"local-case",asOf:"2026-10-14",period:{id:"local-period",label:"Annual",periodEnd:"2025-12-31"},
    facts:[{lineItem:"interest_bearing_debt",value,inputState:"reported",confidenceTier:"Verified",sourceId:"local"},
      {lineItem:"total_assets",value:100,inputState:"reported",confidenceTier:"Verified",sourceId:"local"}],segments:[],
  },expected:{criteria:{[id]:index?"fail":"pass"},status:index?"fails_selected_methodology":"passes_selected_methodology"}}));
}
beforeAll(async()=>{
  control=cliConnection("DATABASE_URL_TEST");
  const [v]=await control`show server_version_num`;
  if(Number(v.server_version_num)<170000||Number(v.server_version_num)>=180000) throw new Error("Disposable PostgreSQL 17 required");
  await control.unsafe(`create database "${database}"`);
  const url=new URL(testDatabaseUrl());url.pathname=`/${database}`;
  owner=postgres(url.href,{max:1,prepare:false,onnotice:()=>{}});
  await applyMigrations(owner);await seedDatabase(owner);
  app=postgres(url.href,{max:4,prepare:false,connection:{options:"-c role=suhail_app"}});
  pub=postgres(url.href,{max:1,prepare:false,connection:{options:"-c role=suhail_public"}});
  boundary.db=drizzle(app,{schema});boundary.publicDb=drizzle(pub,{schema});
  boundary.id=randomUUID();
  await owner`insert into app.users(id,role,full_name) values(${boundary.id},'admin','Local admin')`;
},60000);
afterAll(async()=>{
  await app?.end();await pub?.end();await owner?.end();
  if(control){await control.unsafe(`drop database if exists "${database}"`);await control.end();}
});
async function isolated(work:(tx:Tx,actor:AppUser)=>Promise<void>) {
  try {
    await boundary.db.transaction(async tx=>{
      const [actor]=await tx.select().from(schema.users).where(eq(schema.users.id,boundary.id));
      await work(tx,actor);throw rollback;
    });
  } catch(error){if(error!==rollback)throw error;}
}
async function fixture(tx:Tx,actor:AppUser) {
  const m=await service.saveMethodology(tx,actor,null,{...metadata,slug:`local-${randomUUID()}`});
  const v=await service.saveVersion(tx,actor,m,null,null,content);
  const c=await service.saveCriterion(tx,actor,v,null,rule);
  const [s]=await tx.insert(schema.source).values({label:"Genuine test metadata",source_type:"methodology_document",
    source_url:metadata.source_url,document_title:"Test document",is_demo:false,is_synthetic:false,confidence_tier:"Verified"}).returning();
  await service.associateSource(tx,actor,v,s.id);
  return {m,v,c,s};
}
async function advance(tx:Tx,actor:AppUser,v:string,to:string) {
  const stages=["source_verified","rules_normalized","tests_passed","universe_tested","human_reviewed","approved"];
  for(const stage of stages) {
    const result=await service.transition(tx,actor,v,stage,stage==="human_reviewed"?"Reviewed all evidence":"Local transition");
    expect(result.ok).toBe(true);
    if(stage===to)break;
  }
}
describe("audited governed lifecycle and SQL boundaries",()=>{
  it("refuses private production enablement in the service and direct owner SQL",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);
    await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"approved");
    await expect(service.enableProduction(tx,actor,v,"Private")).rejects.toThrow("Publish the version before enabling production");
    await expect(tx.transaction(async ownerTx=>{
      await ownerTx.execute(sql`set local role postgres`);
      await ownerTx.update(schema.methodologyVersion).set({production_enabled:true}).where(eq(schema.methodologyVersion.id,v));
    })).rejects.toMatchObject({cause:{code:"23514",message:expect.stringContaining("production-enabled version cannot be private")}});
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    expect(version).toMatchObject({is_public:false,production_enabled:false});
  }));
  it("refuses unpublishing production in the service and direct owner SQL",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);
    await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"approved");
    await service.setVisibility(tx,actor,v,true);await service.enableProduction(tx,actor,v,"Public");
    await expect(service.setVisibility(tx,actor,v,false)).rejects.toThrow("production-enabled version cannot be unpublished");
    await expect(tx.transaction(async ownerTx=>{
      await ownerTx.execute(sql`set local role postgres`);
      await ownerTx.update(schema.methodologyVersion).set({is_public:false}).where(eq(schema.methodologyVersion.id,v));
    })).rejects.toMatchObject({cause:{code:"23514",message:expect.stringContaining("production-enabled version cannot be private")}});
  }));
  it("protects the editorial default even when production is disabled",()=>isolated(async(tx,actor)=>{
    const {v}=await fixture(tx,actor);
    await service.setVisibility(tx,actor,v,true);
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:v});
    await expect(service.setVisibility(tx,actor,v,false)).rejects.toThrow("select another default first");
    await expect(tx.transaction(async ownerTx=>{
      await ownerTx.execute(sql`set local role postgres`);
      await ownerTx.update(schema.methodologyVersion).set({is_public:false}).where(eq(schema.methodologyVersion.id,v));
    })).rejects.toMatchObject({cause:{code:"23514",message:expect.stringContaining("editorial default methodology version cannot be unpublished")}});
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:null});
    await service.setVisibility(tx,actor,v,false);
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    expect(version).toMatchObject({is_public:false,production_enabled:false});
  }));
  it("refuses assigning a private default through direct owner SQL",()=>isolated(async(tx,actor)=>{
    const {v}=await fixture(tx,actor);
    await expect(tx.transaction(async ownerTx=>{
      await ownerTx.execute(sql`set local role postgres`);
      await ownerTx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:v});
    })).rejects.toMatchObject({cause:{code:"23514",message:expect.stringContaining("editorial default methodology version must be public")}});
  }));
  it("serializes concurrent default selection and unpublishing",async()=>{
    const id=randomUUID();
    const [parent]=await owner`select id from app.methodology where slug='example-a'`;
    const [setting]=await owner`select id,default_shariah_methodology_version_id from app.editorial_setting where setting_key='editorial'`;
    await owner`insert into app.methodology_version(id,methodology_id,version,is_public) values(${id},${parent.id},${id},true)`;
    let release!:()=>void,ready!:()=>void;
    const held=new Promise<void>(resolve=>{release=resolve;});
    const started=new Promise<void>(resolve=>{ready=resolve;});
    const selecting=owner.begin(async tx=>{
      await tx`update app.editorial_setting set default_shariah_methodology_version_id=${id} where id=${setting.id}`;
      ready();await held;
    });
    let hiding:Promise<unknown>|undefined;
    try {
      await started;
      let identify!:(pid:number)=>void;
      const identified=new Promise<number>(resolve=>{identify=resolve;});
      hiding=app.begin(async tx=>{
        const [backend]=await tx`select pg_backend_pid() as pid`;identify(backend.pid);
        await tx`update app.methodology_version set is_public=false where id=${id}`;
      }).then(()=>null,error=>error);
      const pid=await identified;
      let waiting=false;
      for(let attempt=0;attempt<100;attempt++) {
        const [row]=await control`select exists(select 1 from pg_locks where pid=${pid} and locktype='advisory' and not granted) as waiting`;
        if(row.waiting){waiting=true;break;}
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      expect(waiting).toBe(true);
      release();await selecting;
      expect(await hiding).toMatchObject({code:"23514",message:expect.stringContaining("editorial default methodology version cannot be unpublished")});
      expect((await owner`select is_public from app.methodology_version where id=${id}`)[0].is_public).toBe(true);
    } finally {
      release();await selecting;await hiding;
      await owner`update app.editorial_setting set default_shariah_methodology_version_id=${setting.default_shariah_methodology_version_id} where id=${setting.id}`;
      await owner`delete from app.methodology_version where id=${id}`;
    }
  });
  it("each successful gate, approval and separate production operation are atomic",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    const before=await tx.execute(sql`select (select count(*) from app.screening_run)::int runs,(select count(*) from app.screening_criterion_result)::int criteria,(select count(*) from app.screening_unknown)::int unknowns`);
    await advance(tx,actor,v,"approved");
    await service.setVisibility(tx,actor,v,true);
    await service.enableProduction(tx,actor,v,"Local test only");
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    expect(version).toMatchObject({workflow_status:"approved",production_enabled:true,approved_by:actor.id});
    expect(version.workflow_history).toHaveLength(7);
    expect(version.workflow_history.at(-1)).toMatchObject({from:"approved",to:"approved",operation:"production_enable",actor:actor.id});
    const [approval]=await tx.select().from(schema.auditEvent).where(eq(schema.auditEvent.id,version.approval_id!));
    expect(approval).toMatchObject({event_type:"approval_recorded",entity_id:v,actor_id:actor.id});
    expect(await tx.execute(sql`select (select count(*) from app.screening_run)::int runs,(select count(*) from app.screening_criterion_result)::int criteria,(select count(*) from app.screening_unknown)::int unknowns`)).toEqual(before);
    await expect(service.enableProduction(tx,actor,v,"Again")).rejects.toThrow("already enabled");
  }));
  it("source gate refuses metadata alone",()=>isolated(async(tx,actor)=>{
    const {v}=await fixture(tx,actor);
    await tx.update(schema.methodologyVersion).set({source_ids:[]}).where(eq(schema.methodologyVersion.id,v));
    await expect(service.transition(tx,actor,v,"source_verified","")).rejects.toThrow("genuine verified");
  }));
  it("fabricated documents cannot be associated as genuine verification",()=>isolated(async(tx,actor)=>{
    const {v}=await fixture(tx,actor);
    const [fake]=await tx.insert(schema.source).values({label:"Fake",source_type:"methodology_document",
      source_url:metadata.source_url,document_title:"Fake",is_synthetic:true,is_demo:true}).returning();
    await expect(service.associateSource(tx,actor,v,fake.id)).rejects.toThrow("genuine verified");
  }));
  it("cannot skip stages or repeat a transition",()=>isolated(async(tx,actor)=>{
    const {v}=await fixture(tx,actor);
    await expect(service.transition(tx,actor,v,"approved","")).rejects.toThrow("exactly one");
    await service.transition(tx,actor,v,"source_verified","");
    await expect(service.transition(tx,actor,v,"source_verified","")).rejects.toThrow("exactly one");
  }));
  it("normalization refuses empty rules",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.deleteCriterion(tx,actor,v,c);
    await service.transition(tx,actor,v,"source_verified","");
    await expect(service.transition(tx,actor,v,"rules_normalized","")).rejects.toThrow("at least one");
  }));
  it("test gate records coverage refusal without advancing",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,[cases(c)[0]]);
    await advance(tx,actor,v,"rules_normalized");
    const result=await service.transition(tx,actor,v,"tests_passed","");
    expect(result.ok).toBe(false);
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    expect(version.workflow_status).toBe("rules_normalized");expect(version.test_report_id).toBe(result.reportId);
    const [r]=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.id,result.reportId!));
    expect(r.payload.coverageGaps).toEqual([expect.objectContaining({id:c,label:"Local debt",missing:["fail"]})]);
  }));
  it("empty universe records no securities and allows impact; human note is mandatory",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"universe_tested");
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    const [r]=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.id,version.impact_report_id!));
    expect(r.payload.message).toBe("no securities");
    await expect(service.transition(tx,actor,v,"human_reviewed","   ")).rejects.toThrow("note");
  }));
  it("approval refuses missing same-version reports",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"human_reviewed");
    await tx.update(schema.methodologyVersion).set({impact_report_id:null}).where(eq(schema.methodologyVersion.id,v));
    await expect(service.transition(tx,actor,v,"approved","")).rejects.toThrow("Same-version");
  }));
  it("finalized test cases and criteria are immutable at SQL and service layers",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.transition(tx,actor,v,"source_verified","");
    await expect(service.saveCases(tx,actor,v,[])).rejects.toThrow("immutable");
    await expect(service.saveCriterion(tx,actor,v,c,rule)).rejects.toThrow("immutable");
    await expect(tx.transaction(sp=>sp.execute(sql`update app.methodology_version set analyst_test_cases='[{}]' where id=${v}`))).rejects.toMatchObject({cause:{code:"P0001",message:expect.stringContaining("immutable")}});
    await expect(tx.transaction(sp=>sp.execute(sql`update app.methodology_criterion set threshold=1 where id=${c}`))).rejects.toMatchObject({cause:{code:"P0001",message:expect.stringContaining("immutable")}});
  }));
  it("reports remain append-only and new cases never gain public grants",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"tests_passed");
    await expect(tx.transaction(sp=>sp.execute(sql`update app.methodology_version_report set payload='{}' where methodology_version_id=${v}`))).rejects.toThrow();
    const privilege=await tx.execute<{allowed:boolean}>(sql`select has_column_privilege('suhail_public','app.methodology_version','analyst_test_cases','SELECT') allowed`);
    expect(privilege[0].allowed).toBe(false);
  }));
  it("clone creates new identities, supersedes link and empty analyst suite",()=>isolated(async(tx,actor)=>{
    const {m,v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    const clone=await service.saveVersion(tx,actor,m,null,v,{...content,version:"2"});
    const [copy]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,clone));
    expect(copy.supersedes_version_id).toBe(v);expect(copy.analyst_test_cases).toEqual([]);
    const [cc]=await tx.select().from(schema.methodologyCriterion).where(eq(schema.methodologyCriterion.methodology_version_id,clone));
    expect(cc.id).not.toBe(c);
  }));
  it("production refuses draft, missing license and permanently blocked origins",()=>isolated(async(tx,actor)=>{
    const {m,v,c}=await fixture(tx,actor);
    await expect(service.enableProduction(tx,actor,v,"")).rejects.toThrow("Approval");
    await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"approved");
    await tx.update(schema.methodology).set({licensing_status:"unknown"}).where(eq(schema.methodology.id,m));
    await expect(service.enableProduction(tx,actor,v,"")).rejects.toThrow("licensing");
    await tx.update(schema.methodology).set({is_demo:true}).where(eq(schema.methodology.id,m));
    await tx.update(schema.methodology).set({is_demo:false}).where(eq(schema.methodology.id,m));
    await expect(service.enableProduction(tx,actor,v,"")).rejects.toThrow("permanently blocked");
  }));
});
describe("evidence selection and permissions",()=>{
  it("a rejected audit insert rolls back the methodology write in the same transaction",async()=>{
    const before=await owner`select count(*)::int n from app.methodology`;
    await owner.unsafe(`create function app.local_reject_methodology_audit() returns trigger language plpgsql as $$begin if new.event_type='methodology_create' then raise exception 'local audit refusal'; end if; return new; end$$; create trigger local_audit_refusal before insert on app.audit_event for each row execute function app.local_reject_methodology_audit()`);
    try {
      const result=await methodologyAction({operation:"metadata",id:null,data:{...metadata,slug:`atomic-${randomUUID()}`}});
      expect(result.ok).toBe(false);
      expect(await owner`select count(*)::int n from app.methodology`).toEqual(before);
    }finally {await owner.unsafe("drop trigger local_audit_refusal on app.audit_event; drop function app.local_reject_methodology_audit()");}
  });
  it("impact uses annual current facts and matching segments, not newer quarters",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    const [company]=await tx.insert(schema.company).values({name:"Local issuer"}).returning();
    await tx.insert(schema.security).values({ticker:"LOCAL",slug:"local-issuer",company_id:company.id,in_universe:true});
    const periods=await tx.insert(schema.financialPeriod).values([
      {company_id:company.id,period_type:"annual",fiscal_year:2025,fiscal_period_label:"Annual 2025",period_end:"2025-12-31"},
      {company_id:company.id,period_type:"quarterly",fiscal_year:2026,fiscal_period_label:"Q3 2026",period_end:"2026-09-30"},
    ]).returning();
    for(const [index,p] of periods.entries()) await tx.insert(schema.financialFact).values([
      {company_id:company.id,period_id:p.id,line_item:"interest_bearing_debt",value:index?99:20},
      {company_id:company.id,period_id:p.id,line_item:"total_assets",value:100},
    ]);
    await tx.insert(schema.businessSegment).values({company_id:company.id,period_id:periods[1].id,segment_name:"Quarter only",activity_category:"alcohol"});
    await service.setVisibility(tx,actor,v,true);
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:v}).where(eq(schema.editorialSetting.setting_key,"editorial"));
    await advance(tx,actor,v,"universe_tested");
    const reports=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.methodology_version_id,v));
    const r=reports.find(r=>r.kind==="impact")!.payload;
    expect(r.securities).toEqual([expect.objectContaining({newStatus:"passes_selected_methodology",inputs:expect.objectContaining({period:expect.objectContaining({id:periods[0].id}),segments:[]})})]);
  }));
  it("no baseline with an evaluable universe passes and records first-production evidence",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    await tx.update(schema.security).set({in_universe:false});
    const [company]=await tx.insert(schema.company).values({name:"First production local issuer"}).returning();
    await tx.insert(schema.security).values({ticker:"FIRST",slug:"first-local",company_id:company.id,in_universe:true});
    await tx.insert(schema.financialPeriod).values({company_id:company.id,period_type:"annual",
      fiscal_year:2025,fiscal_period_label:"Annual 2025",period_end:"2025-12-31"});
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:null}).where(eq(schema.editorialSetting.setting_key,"editorial"));
    await advance(tx,actor,v,"tests_passed");
    const result=await service.transition(tx,actor,v,"universe_tested","");
    expect(result.ok).toBe(true);
    const [report]=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.id,result.reportId!));
    expect(report.payload).toMatchObject({passed:true,baselineId:null,baselineError:null,
      baselineNote:"baseline: none (first production methodology)",
      securities:[expect.objectContaining({ticker:"FIRST",error:null,newStatus:"insufficient_data"})]});
    const [version]=await tx.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,v));
    expect(version).toMatchObject({workflow_status:"universe_tested",is_public:false,production_enabled:false});
    const [settings]=await tx.select().from(schema.editorialSetting).where(eq(schema.editorialSetting.setting_key,"editorial"));
    expect(settings.default_shariah_methodology_version_id).toBeNull();
  }));
  it("no baseline plus missing annual evidence is a persisted impact refusal",()=>isolated(async(tx,actor)=>{
    const {v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    await tx.insert(schema.security).values({ticker:"NOEVIDENCE",slug:"no-evidence",in_universe:true});
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:null}).where(eq(schema.editorialSetting.setting_key,"editorial"));
    await advance(tx,actor,v,"tests_passed");
    const result=await service.transition(tx,actor,v,"universe_tested","");
    expect(result.ok).toBe(false);expect(result.reportId).toBeTruthy();
    const [report]=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.id,result.reportId!));
    expect(report.payload).toMatchObject({passed:false,securities:expect.arrayContaining([
      expect.objectContaining({ticker:"NOEVIDENCE",error:"No usable annual period"}),
    ])});
  }));
  it("a configured default with unusable rules remains a persisted refusal",()=>isolated(async(tx,actor)=>{
    const {m,v,c}=await fixture(tx,actor);await service.saveCases(tx,actor,v,cases(c));
    await tx.update(schema.security).set({in_universe:false});
    const baseline=await service.saveVersion(tx,actor,m,null,null,{...content,version:"empty-baseline"});
    await service.setVisibility(tx,actor,baseline,true);
    await tx.update(schema.editorialSetting).set({default_shariah_methodology_version_id:baseline}).where(eq(schema.editorialSetting.setting_key,"editorial"));
    await advance(tx,actor,v,"tests_passed");
    const result=await service.transition(tx,actor,v,"universe_tested","");
    expect(result.ok).toBe(false);
    const [report]=await tx.select().from(schema.methodologyVersionReport).where(eq(schema.methodologyVersionReport.id,result.reportId!));
    expect(report.payload).toMatchObject({passed:false,baselineNote:null,baselineError:"The default baseline has unusable rules"});
  }));
  it("editors can inspect but cannot directly submit any write operation",async()=>{
    boundary.role="editor";
    try {
      const data=await readMethodologies();
      // Compare the concurrent loader to its original serial SQL contract:
      // same table order, row order, document filter and source field allowlist.
      const methodologies=await boundary.db.select().from(schema.methodology).orderBy(schema.methodology.name);
      const versions=await boundary.db.select().from(schema.methodologyVersion).orderBy(desc(schema.methodologyVersion.created_at));
      const criteria=await boundary.db.select().from(schema.methodologyCriterion).orderBy(schema.methodologyCriterion.sort_order);
      const reports=await boundary.db.select().from(schema.methodologyVersionReport).orderBy(desc(schema.methodologyVersionReport.created_at));
      const s=schema.source;
      const sources=await boundary.db.select({id:s.id,label:s.label,source_url:s.source_url,
        document_title:s.document_title,is_demo:s.is_demo,is_synthetic:s.is_synthetic,
        production_blocked:s.production_blocked,confidence_tier:s.confidence_tier})
        .from(s).where(eq(s.source_type,"methodology_document"));
      expect(data).toEqual({methodologies,versions,criteria,reports,sources});
      expect(data.methodologies.length).toBeGreaterThan(0);
      for(const operation of ["metadata","version","criterion","deleteCriterion","cases","source","visibility","transition","production"]) {
        await expect(methodologyAction({operation} as Parameters<typeof methodologyAction>[0])).rejects.toThrow("role_required");
      }
    }finally{boundary.role="admin";}
  });
  it("concurrent transition requests cannot duplicate approval history or audit",async()=>{
    let versionId="";
    await boundary.db.transaction(async tx=>{
      const [actor]=await tx.select().from(schema.users).where(eq(schema.users.id,boundary.id));
      const {v,c}=await fixture(tx,actor);versionId=v;
      await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"human_reviewed");
    });
    const replies=await Promise.all([1,2].map(()=>methodologyAction({operation:"transition",versionId,target:"approved",note:"Concurrency test"})));
    expect(replies.filter(r=>r.ok)).toHaveLength(1);
    const [version]=await boundary.db.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.id,versionId));
    expect(version.workflow_history.filter(h=>h.to==="approved")).toHaveLength(1);
    expect(await owner`select id from app.audit_event where entity_id=${versionId} and event_type='approval_recorded'`).toHaveLength(1);
  });
  it("stale finalized action returns a safe error and does not alter the criterion",async()=>{
    let versionId="",criterionId="";
    await boundary.db.transaction(async tx=>{
      const [actor]=await tx.select().from(schema.users).where(eq(schema.users.id,boundary.id));
      const {v,c}=await fixture(tx,actor);versionId=v;criterionId=c;
      await service.transition(tx,actor,v,"source_verified","");
    });
    const result=await methodologyAction({operation:"criterion",versionId,id:criterionId,data:{...rule,threshold:1}});
    expect(result).toMatchObject({ok:false,error:expect.stringContaining("immutable")});
    expect((await owner`select threshold from app.methodology_criterion where id=${criterionId}`)[0].threshold).toBe("33.000000");
  });
  it("public detail query uses RLS/allowlists and never exposes private identifiers",async()=>{
    const [parent]=await owner`select id from app.methodology where slug='example-a'`;
    await owner`insert into app.methodology_version(methodology_id,version,version_label,is_public) values(${parent.id},'private-secret-version','Internal private label',false)`;
    const page=await getPublicMethodology("example-a");
    expect(page?.documents.every(d=>d.version.is_public)).toBe(true);
    expect(page?.documents.some(d=>d.version.version==="private-secret-version")).toBe(false);
    expect(page?.documents[0].version).not.toHaveProperty("analyst_test_cases");
    expect(page?.documents[0].version).not.toHaveProperty("workflow_history");
    expect(page?.documents[0].criteria.find(c=>c.criterion_type==="receivables")?.borderline_margin).toBeNull();
  });
  it("public documentation prefers production over newer public drafts without changing the site default",async()=>{
    let slug="";
    const [before]=await owner`select default_shariah_methodology_version_id from app.editorial_setting where setting_key='editorial'`;
    await boundary.db.transaction(async tx=>{
      const [actor]=await tx.select().from(schema.users).where(eq(schema.users.id,boundary.id));
      const {m,v,c}=await fixture(tx,actor);
      const [parent]=await tx.select().from(schema.methodology).where(eq(schema.methodology.id,m));slug=parent.slug;
      await service.saveCases(tx,actor,v,cases(c));await advance(tx,actor,v,"approved");
      await service.setVisibility(tx,actor,v,true);
      await service.enableProduction(tx,actor,v,"Disposable local fixture only");
      await service.saveVersion(tx,actor,m,null,null,{...content,version:"2",effective_date:"2026-12-01",is_public:true});
    });
    const page=await getPublicMethodology(slug);
    expect(page?.documents).toHaveLength(2);
    expect(page?.defaultVersion).toBe("1");
    expect((await owner`select default_shariah_methodology_version_id from app.editorial_setting where setting_key='editorial'`)[0]).toEqual(before);
  });
});
