import { readFile } from "node:fs/promises";
import { launchInputs, launchDefinition, LaunchInputError } from "../../src/lib/launch/contracts";
import { runLaunch } from "../../src/lib/launch/run";
import { LaunchPreflightError } from "../../src/lib/launch/draft";
import { dbApp } from "../../src/db/app";

async function main() {
  const args = process.argv.slice(2).filter(a => a !== "--");
  const dryRun = args.includes("--dry-run");
  const rest = args.filter(a => a !== "--dry-run");
  if (rest.length !== 2 || rest[0] !== "--actor" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rest[1]) ||
    args.filter(a => a === "--dry-run").length > 1)
    throw new LaunchInputError("Usage: pnpm setup:launch -- --actor <existing admin email> [--dry-run]");
  const [input, universe, definition] = await Promise.all([
    readFile("data/launch/inputs.csv", "utf8"), readFile("data/launch/universe.csv", "utf8"),
    readFile("data/methodologies/al-rajhi-adapted-1.0.json", "utf8"),
  ]);
  // Validate every row before even accessing the lazy database connection.
  const rows = launchInputs(input, universe);
  const parsed = launchDefinition(JSON.parse(definition));
  try {
    await runLaunch({ email: rest[1], dryRun, definition: parsed, rows, asOf: new Date().toISOString().slice(0, 10) },
      value => console.log(JSON.stringify(value, null, 2)));
  } finally { await dbApp.$client.end(); }
}
main().catch(error => {
  console.error(error instanceof LaunchInputError || error instanceof LaunchPreflightError ? error.message :
    "Launch setup failed; check committed definitions, admin actor and workspace database configuration. No credentials are printed.");
  process.exitCode = 1;
});
