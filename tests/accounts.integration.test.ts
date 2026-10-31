import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { connectDatabase } from "../src/db/connect";
import { verifyRuntimeRole } from "../src/db/verified-sql";
import { lazyRuntimeClient } from "../src/db/runtime-client";
import { applyMigrations } from "../scripts/db/migrate";
import { seedDatabase } from "../scripts/db/seed";
import type { User } from "@supabase/supabase-js";
const boundary=vi.hoisted(()=>({
  db:undefined as unknown as typeof import("../src/db/app").dbApp,
  identity:null as User|null,aal:"aal2",verified:true,factorType:"totp" as "totp"|"phone",
  exchanged:vi.fn(),signOut:vi.fn(),cookieConsent:true,
}));
vi.mock("server-only",()=>({}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("../src/db/app",()=>({get dbApp(){return boundary.db;}}));
vi.mock("../src/lib/auth/server",()=>({serverAuth:async()=>({auth:{
  getSession:async()=>({data:{session:boundary.identity ? {access_token: [
    Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),
    Buffer.from(JSON.stringify({sub:boundary.identity.id,aal:boundary.aal})).toString("base64url"),
    Buffer.from("fixture").toString("base64url"),
  ].join(".")} : null},error:null}),
  getUser:async()=>({data:{user:boundary.identity ? {...boundary.identity,
    factors:boundary.verified?[{id:"factor",status:"verified",factor_type:boundary.factorType}]:[]} : null},error:null}),
  exchangeCodeForSession:boundary.exchanged,
  signOut:boundary.signOut,
  mfa:{
    listFactors:async()=>({data:{totp:boundary.verified?[{id:"factor",status:"verified"}]:[]},error:null}),
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:boundary.aal},error:null}),
  },
}})}));
vi.mock("next/headers",()=>({headers:async()=>new Headers(),cookies:async()=>({get:()=>boundary.cookieConsent?{value:"1"}:undefined,delete:()=>{}})}));
vi.mock("next/navigation",()=>({redirect:(target:string)=>{throw new Error(`REDIRECT:${target}`);},forbidden:()=>{throw new Error("FORBIDDEN:403");}}));
import { registerIdentity } from "../src/lib/auth/registration";
import { requireUser, requireRole, requireMfaBootstrap, requirePageUser, requirePageRole } from "../src/lib/auth/guards";
import { withAdminAction } from "../src/lib/auth/actions";
import { actionError } from "../src/lib/auth/errors";
import { mutateRole } from "../src/lib/auth/admin-mutations";
import { updateLocale, deleteAccount } from "../src/app/[locale]/(private)/account/actions";
import { changeRole, saveSettings } from "../src/app/[locale]/(private)/admin/(protected)/actions";
import { GET as profile } from "../src/app/api/account/profile/route";
import { GET as callback } from "../src/app/[locale]/(private)/auth/callback/route";
import { GET as recover } from "../src/app/[locale]/(private)/auth/recover/route";
import { POST as consent } from "../src/app/[locale]/(private)/auth/consent/accept/route";
import { POST as signOut } from "../src/app/[locale]/(private)/auth/sign-out/route";
import { searchUsers, readAudit, readSettings } from "../src/lib/auth/admin-data";
let owner:Sql, app:Sql, control:Sql, fixtureUrl:string;
const database=`accounts_${randomUUID().replaceAll("-","")}`;
function identity(id=randomUUID(),email:string|undefined="fixture@example.test"):User {
  return {id,email,user_metadata:{full_name:"Fixture"},app_metadata:{},aud:"authenticated",created_at:new Date().toISOString()} as User;
}
async function user(role:"admin"|"editor"|"user"="user") {
  const person=identity();
  await owner`insert into auth.users(id,email) values(${person.id},${person.email!})`;
  await registerIdentity(person,"ar",true);
  await owner`update app.users set role=${role} where id=${person.id}`;
  return person;
}
beforeAll(async()=>{
  vi.stubEnv("SITE_URL","https://fixture.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://auth.fixture.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","fixture-anon");
  control=cliConnection("DATABASE_URL_TEST");
  const [{server_version_num}]=await control`show server_version_num`;
  if(Number(server_version_num)<170000 || Number(server_version_num)>=180000) throw new Error("Disposable PostgreSQL 17 required");
  // Separate, uniquely named disposable DB: preserve the original suite's auth.users stub unchanged.
  await control.unsafe(`create database "${database}"`);
  const url=new URL(testDatabaseUrl());url.pathname=`/${database}`;fixtureUrl=url.href;
  owner=postgres(fixtureUrl,{max:1,prepare:false,onnotice:()=>{}});
  await applyMigrations(owner);await seedDatabase(owner);
  await owner`create schema auth`;
  await owner`create table auth.users(id uuid primary key,email text)`;
  await owner`create type auth.factor_type as enum('totp','webauthn','phone')`;
  await owner`create type auth.factor_status as enum('unverified','verified')`;
  await owner`create table auth.mfa_factors(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,factor_type auth.factor_type,status auth.factor_status,secret text)`;
  app=postgres(fixtureUrl,{max:4,prepare:false,connection:{options:"-c role=suhail_app"}});
  boundary.db=drizzle(app,{schema});
},60000);
beforeEach(()=>{boundary.identity=null;boundary.aal="aal2";boundary.verified=true;boundary.factorType="totp";boundary.cookieConsent=true;boundary.exchanged.mockReset();boundary.signOut.mockReset().mockResolvedValue({error:null});});
afterAll(async()=>{
  await app?.end();await owner?.end();
  if(control) {await control.unsafe(`drop database if exists "${database}"`);await control.end();}
  vi.unstubAllEnvs();
});
const context={params:Promise.resolve({locale:"ar"})};
function post(url:string,values:Record<string,string>) {
  return new Request(`https://fixture.test${url}`,{method:"POST",headers:{origin:"https://fixture.test"},body:new URLSearchParams(values)});
}
describe("verified auth and atomic callbacks",()=>{
  it.each(["accept","decline"])("consent %s ignores forged request/forwarded hosts",async decision=>{
    boundary.identity=await user();
    const request=new Request("https://evil.invalid/auth/consent/accept",{method:"POST",headers:{origin:"https://fixture.test",host:"evil.invalid","x-forwarded-host":"evil.invalid","x-forwarded-proto":"http"},body:new URLSearchParams({decision,next:"/account"})});
    const response=await consent(request,context);
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).origin).toBe("https://fixture.test");
  });
  it("recovery success/failure and sign-out always use the configured origin",async()=>{
    boundary.identity=await user();
    const request=new Request("https://evil.invalid/auth/recover?next=/account",{headers:{host:"evil.invalid","x-forwarded-host":"evil.invalid"}});
    expect((await recover(request,context)).headers.get("location")).toBe("https://fixture.test/account");
    boundary.identity=null;
    expect((await recover(request,context)).headers.get("location")).toBe("https://fixture.test/auth/sign-in");
    const loggedOut=await signOut(new Request("https://evil.invalid/auth/sign-out",{method:"POST",headers:{origin:"https://fixture.test",host:"evil.invalid","x-forwarded-host":"evil.invalid"}}),context);
    expect(loggedOut.headers.get("location")).toBe("https://fixture.test/");
  });
  it("concurrent OAuth route callbacks commit only one registration/consent pair",async()=>{
    const person=identity();
    await owner`insert into auth.users(id,email) values(${person.id},${person.email!})`;
    boundary.identity=person;
    boundary.exchanged.mockResolvedValue({error:null});
    const replies=await Promise.all(Array.from({length:6},()=>callback(new Request("https://fixture.test/auth/callback?code=fixture&next=/account"),context)));
    expect(replies.every(reply=>reply.headers.get("location")==="https://fixture.test/account")).toBe(true);
    expect(await owner`select event_type from app.audit_event where entity_id=${person.id}`).toHaveLength(2);
    expect((await owner`select role from app.users where id=${person.id}`)[0].role).toBe("user");
  });
  it("registration and its privacy-safe audit insert roll back together",async()=>{
    const person=identity();await owner`insert into auth.users(id,email) values(${person.id},${person.email!})`;
    await owner.unsafe(`create function app.fixture_reject_audit() returns trigger language plpgsql as $$begin if new.entity_id='${person.id}' then raise exception 'fixture audit failure';end if;return new;end$$;create trigger fixture_audit before insert on app.audit_event for each row execute function app.fixture_reject_audit()`);
    try {
      await expect(registerIdentity(person,"ar",true)).rejects.toThrow();
      expect(await owner`select id from app.users where id=${person.id}`).toHaveLength(0);
      expect(await owner`select id from app.audit_event where entity_id=${person.id}`).toHaveLength(0);
    }finally {await owner`drop trigger fixture_audit on app.audit_event`;await owner`drop function app.fixture_reject_audit()`;}
  });
  it("registers once under concurrent callbacks with user role, id-only events and nullable email",async()=>{
    const person=identity(undefined,undefined);
    delete person.email;
    await owner`insert into auth.users(id) values(${person.id})`;
    const rows=await Promise.all(Array.from({length:6},()=>registerIdentity(person,"en",true)));
    expect(rows.every(row=>row.role==="user" && row.email===null)).toBe(true);
    const events=await owner`select event_type,entity_id,actor_email,actor_role,details from app.audit_event where entity_id=${person.id} order by event_type`;
    expect(events).toHaveLength(2);
    expect(events.every(e=>e.entity_id===person.id && e.actor_email===null && e.actor_role===null && e.details===null)).toBe(true);
    await owner`update app.users set role='editor',locale_pref='ar',terms_version='old' where id=${person.id}`;
    await registerIdentity(person,"en",true);
    const [stored]=await owner`select role,locale_pref,terms_version from app.users where id=${person.id}`;
    expect(stored).toEqual({role:"editor",locale_pref:"ar",terms_version:"old"});
  });
  it("callback uses explicit safe next, otherwise stored locale, and recovers consumed code",async()=>{
    boundary.identity=await user();
    await owner`update app.users set locale_pref='en' where id=${boundary.identity.id}`;
    boundary.exchanged.mockResolvedValue({error:{message:"code consumed"}});
    let response=await callback(new Request("https://fixture.test/auth/callback?code=consumed"),context);
    expect(response.headers.get("location")).toBe("https://fixture.test/en");
    response=await callback(new Request("https://fixture.test/auth/callback?next=/account"),context);
    expect(response.headers.get("location")).toBe("https://fixture.test/account");
    response=await callback(new Request("https://fixture.test/auth/callback?next=//evil.test"),context);
    expect(response.headers.get("location")).toBe("https://fixture.test/en");
  });
  it("recovers a verified missing app row without claiming consent or needing OAuth code",async()=>{
    const person=identity();boundary.identity=person;
    await owner`insert into auth.users(id,email) values(${person.id},${person.email!})`;
    const response=await recover(new Request("https://fixture.test/auth/recover?next=/account"),context);
    expect(response.headers.get("location")).toContain("/auth/consent?next=%2Faccount");
    await expect(requireUser()).rejects.toMatchObject({code:"consent_required"});
    const accepted=await consent(post("/auth/consent/accept",{decision:"accept",next:"/account"}),context);
    expect(accepted.status).toBe(303);
    expect((await requireUser()).user.id).toBe(person.id);
  });
  it("stale consent is updated and audited once concurrently, decline signs out",async()=>{
    boundary.identity=await user();
    await owner`update app.users set terms_version='old' where id=${boundary.identity.id}`;
    await expect(requireUser()).rejects.toMatchObject({code:"consent_required"});
    await Promise.all([consent(post("/auth/consent/accept",{decision:"accept"}),context),consent(post("/auth/consent/accept",{decision:"accept"}),context)]);
    const [{n}]=await owner`select count(*)::int n from app.audit_event where entity_id=${boundary.identity.id} and event_type='consent_recorded'`;
    expect(n).toBe(2); // first acceptance plus exactly one re-consent
    await consent(post("/auth/consent/accept",{decision:"decline"}),context);
    expect(boundary.signOut).toHaveBeenCalledOnce();
  });
  it("no-session handlers return typed 401 and every profile response is private/no-store",async()=>{
    await expect(requireUser()).rejects.toMatchObject({status:401});
    let response=await profile();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    boundary.identity=await user();
    response=await profile();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(Object.keys(await response.json()).sort()).toEqual(["full_name","id","role"]);
  });
  it("page redirects preserve locale and next, including missing row and stale consent",async()=>{
    await expect(requirePageUser("en","/en/account")).rejects.toThrow("REDIRECT:/en/auth/sign-in?next=%2Fen%2Faccount");
    boundary.identity=identity();
    await expect(requirePageUser("ar","/account")).rejects.toThrow("REDIRECT:/auth/recover?next=%2Faccount");
    boundary.identity=await user();
    await owner`update app.users set privacy_version='old' where id=${boundary.identity.id}`;
    await expect(requirePageUser("ar","/account")).rejects.toThrow("REDIRECT:/auth/consent?next=%2Faccount");
  });
});
describe("role/TOTP assurance matrix and action isolation",()=>{
  it("a contended advisory-lock statement cancels and rolls back, and the same connection recovers",async()=>{
    boundary.identity=await user("admin");
    // D-78: fixtureUrl is a uniquely named disposable loopback database.
    // These short test-only settings do not claim hosted timeout coverage.
    const limited=postgres(fixtureUrl,{max:1,prepare:false,
      connection:{role:"suhail_app",statement_timeout:150}});
    const oldDb=boundary.db;
    boundary.db=drizzle(limited,{schema});
    let unlock!:()=>void;
    let locked!:()=>void;
    const ready=new Promise<void>(resolve=>{locked=resolve;});
    const release=new Promise<void>(resolve=>{unlock=resolve;});
    const held=owner.begin(async tx=>{
      await tx`select pg_advisory_xact_lock(73501947)`;
      locked();
      await release;
    });
    const work=vi.fn(async()=>undefined);
    try {
      await ready;
      let failure:unknown;
      try { await withAdminAction(["admin"],work); } catch(error) { failure=error; }
      const cause=failure as {code?:string;cause?:{code?:string}};
      expect(cause?.code??cause?.cause?.code).toBe("57014");
      expect(actionError(failure)).toEqual({ok:false,error:"operation_failed",status:500});
      expect(work).not.toHaveBeenCalled();
      // A rolled-back transaction leaves no aborted transaction on this
      // single-connection pool; a new query succeeds before releasing the lock.
      expect((await limited`select 1 as recovered`)[0].recovered).toBe(1);
    } finally {
      unlock();await held;
      boundary.db=oldDb;
      await limited.end();
    }
  });
  it.each([
    ["user","aal2",true,"role_required"],["user","aal1",false,"role_required"],
    ["editor","aal1",false,"mfa_enroll_required"],["admin","aal1",true,"mfa_verify_required"],
    ["editor","aal2",false,"mfa_enroll_required"],["admin","aal2",false,"mfa_enroll_required"],
    ["editor","aal2",true,null],["admin","aal2",true,null],
  ] as const)("%s %s verified=%s",async(role,aal,verified,error)=>{
    boundary.identity=await user(role);boundary.aal=aal;boundary.verified=verified;
    if(error) await expect(requireRole()).rejects.toMatchObject({code:error});
    else expect((await requireRole()).user.role).toBe(role);
    if(role!=="user") expect((await requireMfaBootstrap()).user.role).toBe(role);
    else await expect(requireMfaBootstrap()).rejects.toMatchObject({status:403});
  });
  it.each(["aal1","aal2"])("verified non-TOTP factor cannot authorize privileged %s access",async aal=>{
    boundary.identity=await user("admin");boundary.aal=aal;boundary.factorType="phone";
    await expect(requireRole()).rejects.toMatchObject({code:"mfa_enroll_required"});
    await expect(requirePageRole("en","/en/admin")).rejects.toThrow("REDIRECT:/en/admin/mfa/enroll?next=%2Fen%2Fadmin");
  });
  it("MFA page destinations do not recurse; editor cannot read admin-only data",async()=>{
    boundary.identity=await user("editor");boundary.verified=false;boundary.aal="aal1";
    await expect(requirePageRole("en","/en/admin")).rejects.toThrow("REDIRECT:/en/admin/mfa/enroll?next=%2Fen%2Fadmin");
    boundary.verified=true;boundary.aal="aal1";
    await expect(requirePageRole("ar","/admin")).rejects.toThrow("REDIRECT:/admin/mfa/verify?next=%2Fadmin");
    boundary.aal="aal2";
    for(const read of [()=>searchUsers(),()=>readAudit(),()=>readSettings()]) await expect(read()).rejects.toMatchObject({status:403});
  });
  it("mutations require session and constrain identity; editors/admins cannot self-delete",async()=>{
    expect(await updateLocale("en")).toMatchObject({ok:false,status:401});
    boundary.identity=await user();
    const other=await user();
    expect(await updateLocale("en")).toEqual({ok:true});
    const [otherRow]=await owner`select locale_pref from app.users where id=${other.id}`;
    expect(otherRow.locale_pref).toBe("ar");
    expect(await deleteAccount(other.id)).toMatchObject({ok:false,status:400});
    for(const role of ["admin","editor"] as const) {
      boundary.identity=await user(role);
      expect(await deleteAccount("DELETE")).toMatchObject({ok:false,status:403});
    }
  });
  it("deletes only session user, produces exactly one ID-only event, then signs out",async()=>{
    const person=await user();boundary.identity=person;
    expect(await deleteAccount("DELETE")).toEqual({ok:true});
    expect(await owner`select id from app.users where id=${person.id}`).toHaveLength(0);
    expect(await owner`select id from auth.users where id=${person.id}`).toHaveLength(0);
    const events=await owner`select actor_email,actor_role,details,entity_id from app.audit_event where event_type='user_account_deleted' and entity_id=${person.id}`;
    expect(events).toEqual([{actor_email:null,actor_role:null,details:null,entity_id:person.id}]);
    expect(boundary.signOut).toHaveBeenCalledOnce();
  });
  it("admin role change requires note and audits before/after; rollback discards both mutation and audit",async()=>{
    boundary.identity=await user("admin");const target=await user();
    expect(await changeRole(target.id,"editor","")).toMatchObject({ok:false,status:400});
    expect(await changeRole(target.id,"editor","Reviewed")).toEqual({ok:true});
    const [event]=await owner`select details,actor_email,is_demo from app.audit_event where entity_id=${target.id} and event_type='user_role_change'`;
    expect(event.details).toEqual({before:"user",after:"editor",note:"Reviewed"});
    expect(event.is_demo).toBe(false);
    const abortTarget=await user();
    await expect(withAdminAction(["admin"],async(tx,actor)=>{await mutateRole(tx,actor,abortTarget.id,"editor","will roll back");throw new Error("abort");})).rejects.toThrow("abort");
    expect((await owner`select role from app.users where id=${abortTarget.id}`)[0].role).toBe("user");
    expect(await owner`select id from app.audit_event where entity_id=${abortTarget.id} and event_type='user_role_change'`).toHaveLength(0);
  });
  it("serialized concurrent demotions preserve one admin",async()=>{
    // Isolate current admins without editing append-only historical records.
    await owner`update app.users set role='user' where role='admin'`;
    const a=await user("admin"),b=await user("admin");boundary.identity=a;
    const results=await Promise.all([changeRole(a.id,"user","demote"),changeRole(b.id,"user","demote")]);
    expect(results.filter(r=>r.ok)).toHaveLength(1);
    expect((await owner`select count(*)::int n from app.users where role='admin'`)[0].n).toBe(1);
    expect(results.some(r=>!r.ok && ["last_admin","role_required"].includes(r.error))).toBe(true);
  });
});
describe("admin settings and minimum-data enrollment projection",()=>{
  it("settings enforce admin/public versions and audit each changed key",async()=>{
    boundary.identity=await user("editor");
    expect(await saveSettings(null,true)).toMatchObject({ok:false,status:403});
    boundary.identity=await user("admin");
    expect(await saveSettings("not-a-uuid",true)).toMatchObject({ok:false,status:400});
    const [privateVersion]=await owner`insert into app.methodology_version(methodology_id,version,is_public)
      select methodology_id,'settings-private-fixture',false from app.methodology_version limit 1 returning id`;
    expect(await saveSettings(privateVersion.id,true)).toMatchObject({ok:false,status:400});
    const [version]=await owner`select id from app.methodology_version limit 1`;
    await owner`update app.methodology_version set is_public=true where id=${version.id}`;
    await owner`update app.editorial_setting set default_shariah_methodology_version_id=null,allow_ineligible_editor_pick=false where setting_key='editorial'`;
    expect(await saveSettings(version.id,true)).toEqual({ok:true});
    const events=await owner`select details from app.audit_event where event_type='editorial_setting_change'`;
    expect(events).toHaveLength(2);
    expect(events.map(e=>e.details.key).sort()).toEqual(["allow_ineligible_editor_pick","default_shariah_methodology_version_id"]);
    expect((await readSettings()).settings?.allow_ineligible_editor_pick).toBe(true);
    expect((await readAudit({event:"editorial_setting_change"})).total).toBe(2);
  });
  it("projection returns only ID and verified TOTP, denies public and direct auth reads",async()=>{
    boundary.identity=await user("admin");const target=await user();
    await owner`insert into auth.mfa_factors values(${randomUUID()},${target.id},'totp','unverified','never-expose'),(${randomUUID()},${target.id},'webauthn','verified','never-expose')`;
    let result=await app`select * from app.verified_totp_status(array[${target.id}]::uuid[])`;
    expect(result).toEqual([{user_id:target.id,verified_totp:false}]);
    await owner`insert into auth.mfa_factors values(${randomUUID()},${target.id},'totp','verified','never-expose')`;
    result=await app`select * from app.verified_totp_status(array[${target.id}]::uuid[])`;
    expect(result).toEqual([{user_id:target.id,verified_totp:true}]);
    await expect(app`select * from auth.mfa_factors`).rejects.toThrow(/permission denied/);
    await expect(owner.begin(async tx=>{await tx`set local role suhail_public`;await tx`select * from app.verified_totp_status(array[${target.id}]::uuid[])`;})).rejects.toThrow(/permission denied/);
    const rows=await searchUsers("Fixture");
    expect(rows.rows.find(r=>r.id===target.id)?.verified_totp).toBe(true);
  });
});
function cli(command:string,args:string[],extra:Record<string,string>={}) {
  return new Promise<{code:number|null;output:string}>((resolve,reject)=>{
    const env={...process.env,DATABASE_URL_MIGRATIONS:fixtureUrl,...extra};
    const child=spawn("pnpm",[command,...args],{env});let output="";
    child.stdout.on("data",d=>{output+=d;});child.stderr.on("data",d=>{output+=d;});
    child.on("error",reject);child.on("exit",code=>resolve({code,output}));
  });
}
describe("actual workspace CLI entry points (local-only)",()=>{
  it("executes grant, rejects absent user/usage and preserves last admin",async()=>{
    const person=await user();
    await owner`update auth.users set email='bootstrap@example.test' where id=${person.id}`;
    await owner`update app.users set role='user' where role='admin'`;
    const result=await cli("admin:grant",["bootstrap@example.test","admin"]);
    expect(result.code).toBe(0);
    expect((await owner`select role from app.users where id=${person.id}`)[0].role).toBe("admin");
    expect((await owner`select actor_email from app.audit_event where event_type='user_role_change' and entity_id=${person.id}`)[0].actor_email).toBe("system:cli");
    expect((await cli("admin:grant",["missing@example.test","editor"])).code).toBe(1);
    expect((await cli("admin:grant",["bootstrap@example.test","editor"])).code).toBe(1);
    expect((await cli("admin:grant",[])).code).toBe(1);
  },30000);
  it("executes reset with mock Admin API and audits partial success accurately; refuses production",async()=>{
    const person=await user();
    await owner`update auth.users set email='reset@example.test' where id=${person.id}`;
    const removed=randomUUID(),failed=randomUUID();
    const server:Server=createServer((req,res)=>{
      res.setHeader("Content-Type","application/json");
      if(req.method==="GET") res.end(JSON.stringify([{id:removed,factor_type:"totp"},{id:failed,factor_type:"totp"},{id:randomUUID(),factor_type:"webauthn"}]));
      else if(req.url?.endsWith(failed)) {res.statusCode=500;res.end(JSON.stringify({message:"fixture refusal"}));}
      else res.end(JSON.stringify({id:removed}));
    });
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const address=server.address();if(!address || typeof address==="string") throw new Error("fixture bind");
    try {
      const config={NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${address.port}`,SUPABASE_SECRET_KEY:"fixture-shell-only",NODE_ENV:"test"};
      const result=await cli("admin:reset-mfa",["reset@example.test"],config);
      expect(result.code).toBe(1);
      expect(result.output).toContain("1 removed, 1 failed; audited");
      const [event]=await owner`select details from app.audit_event where event_type='user_mfa_reset' and entity_id=${person.id}`;
      expect(event.details).toEqual({removed:[removed],failed:[failed],status:"partial_failure"});
      expect((await cli("admin:reset-mfa",["reset@example.test"],{...config,NODE_ENV:"production"})).code).toBe(1);
    } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
  },30000);
});

describe("native driver identity gate on disposable PostgreSQL", () => {
  it("refuses the actual lazy runtime client using an owner URL even in test mode", async () => {
    vi.stubEnv("DATABASE_URL_APP", fixtureUrl);
    const db = lazyRuntimeClient("DATABASE_URL_APP");
    try {
      await expect(db.execute("select 1")).rejects.toThrow();
      await expect(db.$client.unsafe("select 1")).rejects.toThrow("DATABASE_URL_APP");
    } finally {
      await db.$client.end();
      vi.unstubAllEnvs();
    }
  });
  it.each(["suhail_app", "suhail_public"] as const)(
    "supports real Drizzle queries and transactions after verifying %s", async role => {
      const native = connectDatabase("DATABASE_URL_TEST",
        { ssl:false, max:1, prepare:false }, fixtureUrl);
      try {
        await native.unsafe(`set role ${role}`);
        const key = role === "suhail_app" ? "DATABASE_URL_APP" : "DATABASE_URL_PUBLIC";
        const db = drizzle(verifyRuntimeRole(native, key), {schema});
        const [rows, transaction] = await Promise.all([
          db.select({code:schema.exchange.code}).from(schema.exchange),
          db.transaction(tx => tx.execute("select current_user")),
        ]);
        expect(rows).toHaveLength(2);
        expect(transaction[0].current_user).toBe(role);
      } finally { await native.end(); }
    },
  );
  it("refuses real owner credentials before business SQL and stays refused", async () => {
    const native = connectDatabase("DATABASE_URL_TEST",
      {ssl:false, max:1, prepare:false}, fixtureUrl);
    try {
      const db = drizzle(verifyRuntimeRole(native, "DATABASE_URL_APP"), {schema});
      await expect(db.execute("select 1")).rejects.toThrow();
      await expect(db.transaction(tx => tx.execute("select 1"))).rejects.toThrow("DATABASE_URL_APP");
    } finally { await native.end(); }
  });
});
