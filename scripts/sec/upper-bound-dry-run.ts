import { readFile } from "node:fs/promises";
import { SecClient } from "../../src/ingest/sec/client";
import { runFsnDryRun } from "../../src/ingest/sec/fsn/dry-run";
import { upperBoundSummary } from "../../src/ingest/sec/fsn/summary";

async function main() {
  const raw = process.argv.slice(2).filter(arg => arg !== "--");
  const summary = raw.includes("--summary");
  const args = raw.filter(arg => arg !== "--summary");
  if (args.length && (args.length !== 2 || args[0] !== "--dataset" || !/^\d{4}(?:_(?:0[1-9]|1[0-2])|q[1-4])$/.test(args[1])))
    throw new Error("Usage: pnpm sec:upper-bound:dry-run [-- --summary] [--dataset YYYY_MM|YYYYqN]");
  const covered = (await readFile("data/launch/universe.csv", "utf8")).trim().split(/\r?\n/).slice(1);
  await runFsnDryRun(new SecClient(), covered,
    row => console.log(summary ? upperBoundSummary(row) : JSON.stringify(row, null, 2)), args[1], true);
}
main().catch(() => {
  console.error("Upper-bound comparison failed. No database connection, import or methodology change was attempted.");
  process.exitCode = 1;
});
