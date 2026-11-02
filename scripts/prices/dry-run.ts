import { getPriceEnv } from "../../src/env/jobs-env";
import { dryRun } from "../../src/ingest/prices/run";
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
  if (args.length !== 2) throw new Error("Usage: pnpm prices:dry-run YYYY-MM TICKER");
  try { assertWindow(monthWindow(args[0]), new Date()); }
  catch (e) { console.error(e instanceof Error ? e.message : "Invalid session window"); process.exitCode = 1; return; }
  const { budgetStore, coveredTargets } = await import("../../src/ingest/prices/persistence");
  const { dbApp } = await import("../../src/db/app");
  try {
    const target = (await coveredTargets()).find(t => t.ticker === args[1]);
    if (!target) throw new Error("Requested covered USD security not found");
    await dryRun({ key: env.API_NINJAS_KEY, cap: env.API_NINJAS_MONTHLY_CAP,
      month: args[0], clock: () => new Date(), http: fetch, log: console.log },
    // Do not pass realStore: success AND error paths have budget-only authority.
    { reserveCall: budgetStore.reserveCall }, target);
  } finally { await dbApp.$client.end(); }
}
main().catch(() => { console.error("Dry run refused or rejected; no evidence was written."); process.exitCode = 1; });
