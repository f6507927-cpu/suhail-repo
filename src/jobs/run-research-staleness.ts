import { dbApp } from "../db/app";
import { runResearchStaleness } from "./research-staleness";

if (process.argv.includes("--help")) {
  console.log("Usage: node dist/jobs/research-staleness.js\nRecompute private research staleness flags without requesting drafts.");
} else {
  try {
    console.log(JSON.stringify(await runResearchStaleness()));
  } catch {
    console.error("Research staleness failed; inspect the job configuration and stored evidence.");
    process.exitCode = 1;
  } finally {
    await dbApp.$client.end();
  }
}
