import { dbApp } from "../db/app";
import { ingestUniverse } from "./ingest-sec";

if (process.argv.includes("--help")) {
  console.log("Usage: node dist/jobs/ingest-all.js [job-run-id]\nIngests the whole universe in resumable batches. Operate one ingest process at a time.");
} else {
  try { console.log(JSON.stringify(await ingestUniverse(process.argv[2]))); }
  catch {
    console.error("Universe ingestion failed; inspect the job record and validated configuration.");
    process.exitCode = 1;
  } finally { await dbApp.$client.end(); }
}
