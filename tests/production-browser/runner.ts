import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { stockTestEnvironment } from "../stock-browser/environment";
import { productionFixture, productionRoot } from "./config";

async function main() {
  if (!productionFixture) throw new Error("Production browser fixture must be explicitly enabled");
  const cwd = resolve(productionRoot);
  const next = resolve("node_modules/next/dist/bin/next");
  const mode = process.argv[2];
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^(DATABASE_URL|PG|SUPABASE_|NEXT_PUBLIC_SUPABASE_|SESSION_SECRET|PREVIEW_BASIC_AUTH_|ANTHROPIC_|API_NINJAS_|SEC_USER_AGENT|S3_|REVALIDATE_SECRET|NODE_ENV)/.test(name)) delete env[name];
  }
  Object.assign(env, { SITE_URL: "https://production.fixture.test", SITE_MODE: "live", PUBLIC_DEMO_FIXTURES: "" });
  if (mode === "build") {
    await rm(cwd, { recursive: true, force: true });
    await mkdir(cwd, { recursive: true });
    for (const name of ["src", "public", "content", "data", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) {
      await cp(resolve(name), resolve(cwd, name), { recursive: true });
    }
    // Copied application only: keep the actual SQL, RLS and identity checks.
    // The production application and the regular CI build remain untouched.
    await writeFile(resolve(cwd, "src/db/public.ts"), `
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { connectDatabase } from "./connect";
import { verifyRuntimeRole } from "./verified-sql";
import { runtimeOptions } from "./runtime-client";
let db: ReturnType<typeof create> | undefined;
function create() {
  return drizzle(verifyRuntimeRole(
    connectDatabase("DATABASE_URL_TEST", runtimeOptions, process.env.PLAYWRIGHT_LOOPBACK_PUBLIC_URL ?? ""),
    "DATABASE_URL_PUBLIC"
  ), { schema });
}
export const dbPublic = new Proxy({} as ReturnType<typeof create>, {
  get(_target, key) {
    db ??= create();
    const value = Reflect.get(db, key);
    return typeof value === "function" && key !== "$client" ? value.bind(db) : value;
  }
});
`);
    delete env.PLAYWRIGHT_LOOPBACK_PUBLIC_URL;
  } else {
    delete env.PLAYWRIGHT_LOOPBACK_PUBLIC_URL;
    switch (mode) {
      case "security":
        Object.assign(env, { PORT: "3600", SITE_MODE: "preview", SITE_URL: "https://security.fixture.test", PUBLIC_DEMO_FIXTURES: "1" });
        break;
      case "production":
        env.PORT = "3200";
        break;
      case "isr-outage":
      case "isr-home":
        env.PORT = "3400";
        break;
      default:
        throw new Error(`Unknown production browser fixture mode: ${mode}`);
    }
    if (mode !== "isr-outage") env.PLAYWRIGHT_LOOPBACK_PUBLIC_URL = stockTestEnvironment().DATABASE_URL_PUBLIC;
  }
  const child = spawn(process.execPath, [next, ...(mode === "build" ? ["build"] : ["start", "-H", "127.0.0.1", "-p", env.PORT!])], { cwd, env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => child.kill(signal));
  if (mode === "isr-home") {
    const exited = once(child, "exit");
    try {
      const origin = `http://127.0.0.1:${env.PORT}`;
      let ready = false;
      for (let attempt = 0; attempt < 40 && child.exitCode === null; attempt++) {
        ready = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })
          .then(response => response.ok, () => false);
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!ready) throw new Error("Home cache fixture server did not become ready");
      // Only warm the recovery destination. Methodology routes must have no
      // cache when the first-read failure tests make their first request.
      for (const path of ["/", "/en"]) {
        for (const cache of [null, "HIT"]) {
          const response = await fetch(`${origin}${path}`);
          await response.arrayBuffer();
          if (!response.ok || (cache && response.headers.get("x-nextjs-cache") !== cache))
            throw new Error(`Could not warm ${path} for the database outage test`);
        }
      }
    } finally {
      child.kill();
      await exited;
    }
    return;
  }
  child.once("exit", code => { process.exitCode = code ?? 1; });
}
void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
