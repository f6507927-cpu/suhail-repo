import { readFile } from "node:fs/promises";
import { SecClient } from "../../src/ingest/sec/client";
import { runFsnDryRun } from "../../src/ingest/sec/fsn/dry-run";

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== "--");
  if (args.length && (args.length !== 2 || args[0] !== "--dataset" || !/^\d{4}(?:_(?:0[1-9]|1[0-2])|q[1-4])$/.test(args[1])))
    throw new Error("Usage: pnpm sec:fsn:dry-run [-- --dataset YYYY_MM|YYYYqN]");
  const universe = (await readFile("data/launch/universe.csv", "utf8")).trim().split(/\r?\n/).slice(1);
  await runFsnDryRun(new SecClient(), universe, value => console.log(JSON.stringify(value, null, 2)), args[1]);
}
main().catch(() => {
  console.error("SEC Notes dry run failed; check SEC configuration and archive availability. No database connection or import was attempted.");
  process.exitCode = 1;
});
