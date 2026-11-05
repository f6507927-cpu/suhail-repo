import { beforeEach,describe,expect,it,vi } from "vitest";
const gate=vi.hoisted(()=>({requireRole:vi.fn(async(roles:string[])=>{void roles;throw new Error("Denied by existing role/AAL2 gate");})}));
vi.mock("../src/lib/auth/guards",()=>gate);
vi.mock("server-only",()=>({}));
vi.mock("../src/db/app",()=>({dbApp:{}}));
vi.mock("../src/lib/auth/actions",()=>({withAdminAction:vi.fn(()=>{throw new Error("Must not write after denial");})}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { financialAction } from "../src/app/[locale]/(private)/admin/(protected)/financial-actions";
import { runScreenAction,runUniverseAction,verifyScreenAction } from "../src/app/[locale]/(private)/admin/(protected)/screening-actions";
import { readAudit,readSettings } from "../src/lib/auth/admin-data";
describe("UI-9 leaves action authorization intact",()=>{
  beforeEach(()=>vi.clearAllMocks());
  for(const [name,roles,call] of [
    ["financial action",["admin"],()=>financialAction({operation:"lookup",data:{ticker:"FIX"}})],
    ["single screening",["admin"],()=>runScreenAction({securityId:"fixture",methodologyVersionId:"fixture"})],
    ["bulk screening",["admin"],()=>runUniverseAction("screen")],
    ["bulk ingestion",["admin"],()=>runUniverseAction("ingest")],
    ["stored verification",["admin","editor"],()=>verifyScreenAction("fixture")],
    ["settings read",["admin"],()=>readSettings()],
    ["audit read",["admin"],()=>readAudit({})],
  ] as const) it(`${name} reaches its unchanged role gate before any work`,async()=>{
    await call().catch(()=>undefined);
    expect(gate.requireRole).toHaveBeenCalledExactlyOnceWith([...roles]);
  });
});
