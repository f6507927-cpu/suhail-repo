import "server-only";
import { z } from "zod";
import { blankToUndefined, parseEnv } from "./shared";

const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/ });
const dbEnvSchema = z.object({
  // Required only when a non-test database connection opens; non-secret Supabase CA PEM.
  SUPABASE_DB_CA_CERT: z.preprocess(blankToUndefined, z.string().optional()),
  // Optional for app reads; required by workspace/CI migration commands only.
  DATABASE_URL_MIGRATIONS: z.preprocess(
    blankToUndefined,
    postgresUrl.optional(),
  ),
  // Required: RLS-limited public connection.
  DATABASE_URL_PUBLIC: postgresUrl,
  // Required: app and jobs connection.
  DATABASE_URL_APP: postgresUrl,
  // Optional for the app; required by database tests only.
  DATABASE_URL_TEST: z.preprocess(blankToUndefined, postgresUrl.optional()),
});

export function getDbEnv() {
  return parseEnv("Database", dbEnvSchema);
}
