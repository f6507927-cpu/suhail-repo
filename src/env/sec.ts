import "server-only";
import { z } from "zod";
import { parseEnv } from "./shared";

const secEnvSchema = z.object({
  // Required: identifying SEC EDGAR user agent and contact address.
  SEC_USER_AGENT: z.string().min(1),
});

export function getSecEnv() {
  return parseEnv("SEC EDGAR", secEnvSchema);
}
