import "server-only";
import { z } from "zod";
import { blankToUndefined, parseEnv } from "./shared";

const jobsEnvSchema = z.object({
  // Optional: positive integer batch size, default 100.
  JOB_BATCH_SIZE: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().default(100),
  ),
});

export function getJobsEnv() {
  return parseEnv("Jobs", jobsEnvSchema);
}
