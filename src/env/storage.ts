import "server-only";
import { z } from "zod";
import { parseEnv } from "./shared";

const storageEnvSchema = z.object({
  // Required: S3-compatible API endpoint.
  S3_ENDPOINT: z.url(),
  // Required: storage region.
  S3_REGION: z.string().min(1),
  // Required: storage access key ID.
  S3_ACCESS_KEY_ID: z.string().min(1),
  // Required: storage secret access key.
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  // Required: public media bucket.
  S3_BUCKET_PUBLIC: z.string().min(1),
  // Required: public media base URL.
  PUBLIC_MEDIA_BASE_URL: z.url(),
});

export function getStorageEnv() {
  return parseEnv("Storage", storageEnvSchema);
}
