import { expect, it } from "vitest";
import { Project } from "ts-morph";
import { routeInventory } from "../src/security/route-inventory";
import { discoverAccessEntries, inventoryViolations } from "../scripts/route-inventory";
it("lists every existing page, method, metadata handler and server action explicitly", () => {
  expect(inventoryViolations(routeInventory, discoverAccessEntries())).toEqual([]);
  expect(Object.keys(routeInventory).some(key => key.includes("*"))).toBe(false);
});
it.each([
  ["src/app/new/page.tsx", "export default function Page(){}"],
  ["src/app/api/new/route.ts", "export const GET = () => null; export async function POST(){}"],
  ["src/app/new/actions.ts", '"use server"; export async function action(){}'],
  ["src/app/new/page.tsx", 'export default function Page(){async function action(){"use server";} return null}'],
  ["src/app/new/sitemap.ts", "export default function sitemap(){}"],
])("fails closed on additions: %s", (file, code) => {
  const project = new Project({useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true});
  const source = project.createSourceFile(file, code, {overwrite:true});
  const found = discoverAccessEntries([source]);
  expect(found.length).toBeGreaterThan(0);
  expect(inventoryViolations({}, found).every(error => error.startsWith("Unlisted"))).toBe(true);
});
it("new inline actions or methods cannot inherit approval from an existing file",()=>{
  const project=new Project({skipAddingFilesFromTsConfig:true});
  const page="src/app/[locale]/(public)/page.tsx";
  const source=project.createSourceFile(page,'export default function Page(){const added=async()=>{"use server";}; return null}',{overwrite:true});
  expect(inventoryViolations({[`${page}#page`]:"public"},discoverAccessEntries([source]))).toEqual([expect.stringContaining("#inline:")]);
  const route="src/app/api/health/route.ts";
  const handler=project.createSourceFile(route,"export function GET(){}; export function POST(){}",{overwrite:true});
  expect(inventoryViolations({[`${route}#GET`]:"public"},discoverAccessEntries([handler]))).toEqual([`Unlisted access entry: ${route}#POST`]);
});
