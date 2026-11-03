import { dbApp } from "../../src/db/app";
import { installV11, V11InstallError } from "../../src/lib/methodology/install-v11";

async function main() {
  const args = process.argv.slice(2).filter(a => a !== "--");
  const rest = args.filter(a => a !== "--dry-run"), dryRun = args.includes("--dry-run");
  if (rest.length !== 2 || rest[0] !== "--actor" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rest[1]) ||
    args.filter(a => a === "--dry-run").length > 1)
    throw new V11InstallError("Usage: pnpm setup:methodology-v11 -- --actor <existing admin email> [--dry-run]");
  try {
    console.log(JSON.stringify(await dbApp.transaction(tx => installV11(tx, rest[1], dryRun)), null, 2));
  } finally { await dbApp.$client.end(); }
}
main().catch(error => {
  console.error(error instanceof V11InstallError ? error.message :
    "v1.1 installation failed; transaction rolled back. Check actor, definition and database configuration.");
  process.exitCode = 1;
});
