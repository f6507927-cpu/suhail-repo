import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Next compiles NODE_ENV to development/production. Do not weaken the real
// application's D-91 boundary to accommodate local browser tests. Only the
// generated test copy replaces dbPublic's connection factory with the existing
// strict loopback TEST parser; SQL, role verification, RLS and routes are real.
if (process.env.NODE_ENV !== "test") throw new Error("Search browser server is test-only");
const root = process.cwd();
const out = path.join(root, "generated-artifacts/next-search");
await mkdir(out, { recursive: true });
for (const name of ["src", "public", "content"])
  await rm(path.join(out, name), { recursive: true, force: true });
for (const name of ["src", "public", "content", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"])
  await cp(path.join(root, name), path.join(out, name), { recursive: true });
await writeFile(path.join(out, "src/db/public.ts"), `
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { connectDatabase } from "./connect";
import { verifyRuntimeRole } from "./verified-sql";
import { runtimeOptions } from "./runtime-client";
const create = () => drizzle(verifyRuntimeRole(
  connectDatabase("DATABASE_URL_TEST", runtimeOptions, "postgresql://suhail_public@127.0.0.1:55432/suhail_test"),
  "DATABASE_URL_PUBLIC"
), { schema });
let db: ReturnType<typeof create> | undefined;
export const dbPublic = new Proxy({} as ReturnType<typeof create>, {
  get(_target, key) {
    db ??= create();
    const value = Reflect.get(db, key);
    return typeof value === "function" && key !== "$client" ? value.bind(db) : value;
  }
});
`);
// Do not pass workspace credentials to the copied app, even on accidental
// navigation to private routes. The only database target is hardcoded loopback.
const env = { ...process.env };
for (const key of Object.keys(env))
  if (/^(DATABASE_URL|PG|SUPABASE_|NEXT_PUBLIC_SUPABASE_|SESSION_SECRET|NODE_ENV)/.test(key))
    delete env[key];
Object.assign(env, {
  SITE_MODE: "live",
  HOSTNAME: "127.0.0.1",
  NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-test-key",
});
function run(script: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: out, env, stdio: "inherit" });
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Search fixture server exited ${code}`)));
  });
}
await run(path.join(root, "node_modules/next/dist/bin/next"), ["build"]);
// Match this repository's production/browser runner (pnpm start), including
// its bind address. Packaging/relocation is a separate deployment check.
await run(path.join(root, "node_modules/next/dist/bin/next"), ["start", "-H", "0.0.0.0", "-p", "3500"]);
