import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// A separate Next production build, not a flag/route in the runnable application.
// Copy the CURRENT application so all real root layouts, proxy, next/script,
// navigation and hydration code run unchanged. Replace only module-boundary IO.
const root = process.cwd();
const out = path.join(root, "generated-artifacts/next-hydration");
await mkdir(out, { recursive: true });
// Remove copied sources so deleted/renamed application modules cannot survive
// from an earlier run. Keep only Next's build cache, never stale source files.
for (const name of ["src", "public", "content"])
  await rm(path.join(out, name), { recursive: true, force: true });
for (const name of ["src", "public", "content", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"])
  await cp(path.join(root, name), path.join(out, name), { recursive: true });
const guards = await readFile("tests/next-hydration/guards.ts", "utf8");
await cp(path.join(out, "src/lib/auth/guards.ts"), path.join(out, "src/lib/auth/guards-contract.ts"));
await writeFile(path.join(out, "src/lib/auth/guards.ts"), guards
  .replaceAll('"../../src/lib/auth/guards"', '"./guards-contract"')
  .replace('"../../src/lib/auth/errors"', '"./errors"')
  .replace('"../../src/lib/auth/policies"', '"./policies"'));
await writeFile(path.join(out, "src/db/methodology-public.ts"), `
export const getPublicMethodologies: typeof import("./methodology-public-contract").getPublicMethodologies = async () => [];
export const getPublicMethodology: typeof import("./methodology-public-contract").getPublicMethodology = async () => null;
export type {PublicMethodologyGroup, PublicMethodologyPageData} from "./methodology-public-contract";
`);
await cp("src/db/methodology-public.ts", path.join(out, "src/db/methodology-public-contract.ts"));
// Keep the real admin screen, data shape and redirect from /admin.
const adminData = await readFile("src/lib/methodology/admin-data.ts", "utf8");
await cp("src/lib/methodology/admin-data.ts", path.join(out, "src/lib/methodology/admin-data-contract.ts"));
await writeFile(path.join(out, "src/lib/methodology/admin-data.ts"), `
import type {MethodologyAdminData} from "./admin-data-contract";
export type {MethodologyAdminData} from "./admin-data-contract";
export async function readMethodologies(): Promise<MethodologyAdminData> {
 return {methodologies:[], versions:[], criteria:[], reports:[], sources:[]};
}
`);
// Refuse stale assumptions if the module being substituted changes its contract.
if (!adminData.includes("readMethodologies")) throw new Error("Fixture boundary changed");
// No Supabase browser session or external provider IO in this test project.
await cp("src/lib/auth/browser.ts", path.join(out, "src/lib/auth/browser-contract.ts"));
await writeFile(path.join(out, "src/lib/auth/browser.ts"), `
export function createBrowserAuth(): ReturnType<typeof import("./browser-contract").createBrowserAuth> { return null; }
`);
const next = path.join(root, "node_modules/next/dist/bin/next");
const env = { ...process.env, TZ: "UTC", PORT: "3500" };
// Even an accidentally submitted real server action must fail closed: this
// isolated project cannot receive workspace database/provider credentials.
for (const key of Object.keys(env)) {
  if (/^(DATABASE_URL|PG|SUPABASE_|NEXT_PUBLIC_SUPABASE_|SESSION_SECRET)/.test(key))
    delete env[key as keyof typeof env];
}
Object.assign(env, {
  SITE_MODE: "live",
  HOSTNAME: "0.0.0.0",
  NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key",
});
function run(args: string[], script = next) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: out, env, stdio: "inherit" });
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.once(signal, () => child.kill(signal));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Next ${args[0]} exited ${code}`)));
  });
}
await run(["build"]);
const standalone = path.join(out, ".next/standalone/generated-artifacts/next-hydration");
await cp(path.join(out, "public"), path.join(standalone, "public"), { recursive: true });
await cp(path.join(out, ".next/static"), path.join(standalone, ".next/static"), { recursive: true });
await run([], path.join(standalone, "server.js"));
