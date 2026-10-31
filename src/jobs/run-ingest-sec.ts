import { runIngestBatch } from "./ingest-sec";
import { dbApp } from "../db/app";

if (process.argv.includes("--help")) {
  console.log("Usage: node dist/jobs/ingest-sec.js [job-run-id]\nProcesses one JOB_BATCH_SIZE batch; pass the recorded job ID to resume. Run one ingest process at a time.");
} else {
  runIngestBatch(process.argv[2]).then(id => console.log(`SEC ingestion batch recorded: ${id}`))
    .catch(() => { console.error("SEC ingestion job failed; inspect job history and configuration"); process.exitCode = 1; })
    .finally(() => dbApp.$client.end());
}
