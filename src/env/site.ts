import "server-only";
import { z } from "zod";
import { blankToUndefined, parseEnv } from "./shared";

const siteEnvSchema = z
  .object({
    // Required: canonical site URL.
    SITE_URL: z.url(),
    // Optional: defaults to preview (D-24).
    SITE_MODE: z.preprocess(
      blankToUndefined,
      z.enum(["preview", "live"]).default("preview"),
    ),
    // Optional: temporary sanitized forwarding diagnostics; off unless "1".
    FORWARDED_DIAGNOSTICS: z.preprocess(blankToUndefined, z.enum(["0", "1"]).optional()),
  });

export function getSiteEnv() {
  return parseEnv("Site", siteEnvSchema);
}

// Metadata needs only the canonical origin.
export function getSiteUrl() {
  return parseEnv("Site metadata", z.object({ SITE_URL: z.url() })).SITE_URL;
}
