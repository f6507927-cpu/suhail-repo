import { getPriceEnv } from "../../src/env/jobs-env";
import { runMonth } from "../../src/ingest/prices/run";
import { assertWindow, monthWindow } from "../../src/ingest/prices/calendar";
import { apiNinjasStorageReady } from "../../src/ingest/prices/storage-ready";

async function main() {
  const env = getPriceEnv();
  if (!env.API_NINJAS_KEY) { console.log("API Ninjas disabled: API_NINJAS_KEY is unset"); return; }
  if (!apiNinjasStorageReady()) {
    console.error("API Ninjas storage disabled: migration application and verification require separate authorization.");
    process.exitCode = 1; return;
  }
  const args = process.argv.slice(2).filter(a => a !== "--");
  if (args.length !== 1) throw new Error("Usage: pnpm prices:month YYYY-MM");
  try { assertWindow(monthWindow(args[0]), new Date()); }
  catch (e) { console.error(e instanceof Error ? e.message : "Invalid session window"); process.exitCode = 1; return; }
  const { realStore } = await import("../../src/ingest/prices/persistence");
  const { dbApp } = await import("../../src/db/app");
  try {
    await runMonth({ key: env.API_NINJAS_KEY, cap: env.API_NINJAS_MONTHLY_CAP,
      month: args[0], clock: () => new Date(), http: fetch, log: console.log }, realStore);
  } finally { await dbApp.$client.end(); }
}
main().catch(() => { console.error("Month run refused or failed; check month, session window and job configuration."); process.exitCode = 1; });
