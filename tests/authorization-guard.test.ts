import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { authorizationViolations, scanAuthorization, scanAuthorizationSources } from "../scripts/authorization-guard";
const prefix=`import { requireRole } from "@/lib/auth/guards";`;
function check(code:string) {
  const p=new Project({useInMemoryFileSystem:true});
  return authorizationViolations(p.createSourceFile(`${process.cwd()}/src/app/api/fixture/route.ts`,code));
}
describe("AST authorization guard",()=>{
  it.each(["src/app/route.ts","src/app/[locale]/(private)/admin/data/route.ts","src/app/[locale]/(private)/admin/data/route.js","src/app/api/internal/data/route.ts","src/app/api/hooks/secret/route.ts"])("discovers and rejects unguarded %s",file=>{
    const p=new Project({useInMemoryFileSystem:true,compilerOptions:{allowJs:true}});
    const source=p.createSourceFile(`${process.cwd()}/${file}`,"export async function GET(){return readInternal();}");
    expect(scanAuthorizationSources([source])).not.toEqual([]);
    source.replaceWithText(`${prefix}export async function GET(){await requireRole(['admin']);return readInternal();}`);
    expect(scanAuthorizationSources([source])).toEqual([]);
  });
  it.each([
    "export default function Page(){async function save(){'use server';return mutate();}return save;}",
    `export default function Page(){const save=async()=>{'use server';return mutate();};return save;}`,
    `export default function Page(){const save=async()=>{'use\\x20server';return mutate();};return save;}`,
  ])("discovers nested inline actions", code=>{
    const p=new Project({useInMemoryFileSystem:true});
    const source=p.createSourceFile(`${process.cwd()}/src/app/[locale]/(private)/admin/page.tsx`,code);
    expect(scanAuthorizationSources([source])).not.toEqual([]);
    source.replaceWithText(`${prefix} export default function Page(){const save=async()=>{'use server';await requireRole(['admin']);return mutate();};return save;}`);
    expect(scanAuthorizationSources([source])).toEqual([]);
  });
  it("a lifecycle route cannot quietly gain an internal data read",()=>{
    const p=new Project({useInMemoryFileSystem:true});
    const source=p.createSourceFile(`${process.cwd()}/src/app/[locale]/(private)/auth/start/route.ts`,"export async function POST(){return readInternal();}");
    expect(scanAuthorizationSources([source])).not.toEqual([]);
  });
  it("route config cannot disguise internal work before handler authorization",()=>{
    expect(check(`${prefix}export const dynamic=readInternal();export async function GET(){await requireRole(['admin']);return null;}`)).not.toEqual([]);
  });
  it("guards every server action/API handler",()=>expect(scanAuthorization()).toEqual([]),20000);
  it.each([
    `${prefix} export async function GET(){await requireRole(['admin']); return read();}`,
    `${prefix} export async function GET(){try {const user=await requireRole(['admin']);return user;}catch {return null;}}`,
    `import { withUserAction } from "@/lib/auth/actions";export async function save(){return await withUserAction(async tx=>tx);}`,
  ])("accepts canonical first authorization %s",code=>expect(check(code)).toEqual([]));
  it.each([
    `${prefix} export async function GET(){return read();}`,
    `${prefix} export async function GET(){await read();await requireRole();}`,
    `${prefix} export async function GET(){if(true)await requireRole();return read();}`,
    `import { requireRole as guard } from "@/lib/auth/guards";export async function GET(){await guard();}`,
    `import { requireRole } from "@/lib/fake";export async function GET(){await requireRole();}`,
    `${prefix} const wrapper=async()=>requireRole();export async function GET(){await wrapper();}`,
    `${prefix} export const GET=async()=>{await requireRole();};`,
    `export { GET } from './unguarded';`,
    `${prefix} export async function GET(){const wrapper=()=>requireRole();await wrapper();return read();}`,
    `${prefix} export async function GET(requireRole){await requireRole();return read();}`,
    `import type { requireRole } from "@/lib/auth/guards";export async function GET(){await requireRole();}`,
    `${prefix} export async function GET(){try{await requireRole();}catch{}return read();}`,
    `${prefix} export async function GET(){try{await requireRole();}catch{return read();}}`,
    `${prefix} export async function GET(){try{await requireRole();}finally{await write();}}`,
    `${prefix} export async function GET(){await requireRole(await read());return {};}`,
  ])("rejects read/write, alias and wrapper bypass %s",code=>expect(check(code).length).toBeGreaterThan(0));
});
