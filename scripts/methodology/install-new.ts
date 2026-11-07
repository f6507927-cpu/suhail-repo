import { dbApp } from "../../src/db/app";
import { installNewMethodology, NewMethodologyInstallError } from "../../src/lib/methodology/install-new";
import type { NewMethodologyKey } from "../../src/lib/methodology/new-methodologies";

/** D-171/D-172: founder-run only. Never approves, publishes or enables production. */
async function main() {
  const args = process.argv.slice(2).filter(a => a !== "--");
  const [key, ...flags] = args;
  const rest = flags.filter(a => a !== "--dry-run"), dryRun = flags.includes("--dry-run");
  if (!["aaoifi", "msci"].includes(key) || rest.length !== 2 || rest[0] !== "--actor" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rest[1]) || flags.filter(a => a === "--dry-run").length > 1)
    throw new NewMethodologyInstallError("Usage: pnpm setup:methodology-<aaoifi|msci> -- --actor <existing admin email> [--dry-run]");
  const today = new Date().toISOString().slice(0, 10);
  try {
    console.log(JSON.stringify(await dbApp.transaction(tx =>
      installNewMethodology(tx, key as NewMethodologyKey, rest[1], dryRun, today)), null, 2));
  } finally { await dbApp.$client.end(); }
}
main().catch(error => {
  console.error(error instanceof NewMethodologyInstallError ? error.message :
    "Methodology installation failed; transaction rolled back. Check actor, definition and database configuration.");
  process.exitCode = 1;
});
