import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

export async function httpActionChecks(output: string, mode: "render" | "actions" = "actions", baseline = false) {
  await mkdir(`${output}/app`, { recursive: true });
  await writeFile(`${output}/package.json`, '{"private":true,"type":"module"}');
  await writeFile(`${output}/next.config.mjs`, 'export default {cacheComponents:false,devIndicators:false};');
  await writeFile(`${output}/app/layout.js`, 'export default function Layout({children}) {return <html><body>{children}</body></html>;}');
  await mkdir(`${output}/app/api/health`, { recursive: true });
  await writeFile(`${output}/app/api/health/route.js`, 'export function GET(){return Response.json({ok:true});}');
  if (mode === "render") {
    await mkdir(`${output}/app/admin/methodologies`, { recursive: true });
    await writeFile(`${output}/app/admin/methodologies/page.js`, `
import {renderMethodology} from "../../../run.cjs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const {node,authCalls,roleLookups,maxQueries,sessionReads} = await renderMethodology();
  return <div data-auth-calls={authCalls} data-role-lookups={roleLookups}
    data-max-queries={maxQueries} data-session-reads={sessionReads}>{node}</div>;
}`);
  }
  await writeFile(`${output}/app/page.js`, `
import {redirect} from "next/navigation";
import {execute} from "../run.cjs";
async function bulk(form) {
  "use server";
  const report = await execute(form.get("kind"));
  redirect("/?report=" + encodeURIComponent(JSON.stringify(report)));
}
export default async function Page({searchParams}) {
  const {report} = await searchParams;
  return <main><form action={bulk}>
    {["ingest","screen","cancel"].map(kind=><button key={kind} name="kind" value={kind}>{kind}</button>)}
  </form><pre id="result">{report ?? ""}</pre></main>;
}`);
  const child = spawn(process.execPath, [
    resolve("node_modules/next/dist/bin/next"), "dev", output,
    "--webpack", "--hostname", "127.0.0.1", "--port", "3500",
  ], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME,
      NODE_ENV: "development", SITE_MODE: "live", NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));
  const browser = mode === "actions" ? await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  }) : undefined;
  try {
    const deadline = Date.now() + 90_000;
    while (true) {
      try {
        const response = await fetch("http://127.0.0.1:3500/api/health", { signal: AbortSignal.timeout(5000) });
        if (response.ok) break;
      } catch { /* Only startup, no provider requests from this process. */ }
      if (child.exitCode !== null || Date.now() >= deadline)
        throw new Error(`Isolated Next action server failed: ${logs.join("").slice(-4000)}`);
      await delay(200);
    }
    if (mode === "render") {
      const samples = [];
      for (let index = 0; index < 11; index++) {
        const start = performance.now();
        const response = await fetch("http://127.0.0.1:3500/admin/methodologies", {
          cache: "no-store", signal: AbortSignal.timeout(60_000),
        });
        const ttfb = performance.now() - start;
        const body = await response.text();
        const total = performance.now() - start;
        assert.equal(response.status, 200, body.slice(-1000));
        assert.ok(body.includes('id="methodology-fixture"'));
        const count = (name: string) => Number(new RegExp(`data-${name}="(\\d+)"`).exec(body)?.[1]);
        const authCalls = count("auth-calls");
        const roleLookups = count("role-lookups");
        const maxQueries = count("max-queries");
        assert.equal(authCalls, baseline ? 7 : 2);
        assert.equal(roleLookups, baseline ? 3 : 1);
        assert.equal(maxQueries, baseline ? 1 : 5);
        samples.push({ status: response.status, ttfb, total, authCalls, roleLookups, maxQueries });
      }
      console.log(JSON.stringify({ mode: "Next HTTP methodology fixture", baseline,
        providerLatencyMs: 15, databaseQueryLatencyMs: 15,
        cold: samples[0], warm: samples.slice(1) }, null, 2));
      return;
    }
    const page = await browser!.newPage();
    const reports = [];
    for (const kind of ["ingest", "screen", "cancel"]) {
      await page.goto("http://127.0.0.1:3500");
      const post = page.waitForRequest(req => req.method() === "POST");
      await page.getByRole("button", { name: kind, exact: true }).click();
      const request = await post;
      assert.ok(request.headers()["next-action"], "Must use a real Next Server Action HTTP dispatch");
      await page.waitForURL("**/?report=*");
      const report = JSON.parse(await page.locator("#result").innerText());
      assert.equal(report.kind, kind);
      assert.equal(report.authCalls, kind === "cancel" ? 2 : 4);
      assert.equal(report.sessionReads, kind === "cancel" ? 2 : 4);
      assert.equal(report.transactionLocks, kind === "cancel" ? 1 : 3);
      assert.equal(report.transactionalRoleRechecks, kind === "cancel" ? 0 : 3);
      assert.equal(report.result.ok, kind !== "cancel");
      if (kind === "cancel") {
        assert.equal(report.rollbacks, 1);
        assert.equal(report.result.error, "Screening operation failed. Check the inputs and methodology, then try again.");
      }
      reports.push(report);
    }
    console.log(JSON.stringify({ dispatch: "Next HTTP Server Actions", reports }, null, 2));
  } finally {
    await browser?.close();
    child.kill("SIGTERM");
    const force = setTimeout(() => child.kill("SIGKILL"), 5000);
    force.unref();
    await new Promise<void>(resolve => {
      if (child.exitCode !== null) resolve(); else child.once("exit", () => resolve());
    });
    clearTimeout(force);
  }
}
