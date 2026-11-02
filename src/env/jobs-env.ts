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

// D-153: optional provider configuration cannot break unrelated screening jobs.
const priceKeySchema = z.object({
  API_NINJAS_KEY: z.preprocess(blankToUndefined, z.string().trim().min(1).optional()),
});
export function getPriceEnv() {
  const key = parseEnv("Price provider", priceKeySchema);
  if (!key.API_NINJAS_KEY) return { ...key, API_NINJAS_MONTHLY_CAP: 500 };
  return parseEnv("Price provider", priceKeySchema.extend({
    API_NINJAS_MONTHLY_CAP: z.preprocess(blankToUndefined,
      z.coerce.number().int().positive().max(2147483647).default(500)),
  }));
}
