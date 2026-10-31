import { dbApp } from "../db/app";
import { screenUniverse } from "./screen-universe";

if (process.argv.includes("--help")) {
  console.log("Usage: node dist/jobs/screen-universe.js [job-run-id]\nScreens the whole universe in resumable batches. Pass a recorded job ID to resume.");
} else {
  try {
    const result = await screenUniverse(process.argv[2]);
    console.log(result.message ?? JSON.stringify(result));
  } catch {
    console.error("Universe screening failed; inspect the job record and validated configuration.");
    process.exitCode = 1;
  } finally {
    await dbApp.$client.end();
  }
}
