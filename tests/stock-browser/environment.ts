import { databaseUrl } from "../../src/db/connection-url";
import { LOCAL_TEST_DATABASE_URL } from "../../scripts/db/test-target";

/** Resolve once before any subprocess, connection or mutation. Never inherit app targets. */
export function stockTestEnvironment(target = process.env.DATABASE_URL_TEST) {
  const test = databaseUrl("DATABASE_URL_TEST", target ?? LOCAL_TEST_DATABASE_URL);
  const publicUrl = new URL(test);
  // Materialize PostgreSQL's username-as-database default before changing identity.
  if (!publicUrl.pathname || publicUrl.pathname === "/")
    publicUrl.pathname = publicUrl.username;
  publicUrl.username = "suhail_public";
  publicUrl.password = "";
  return {
    NODE_ENV: "test" as const,
    SITE_MODE: "preview",
    DATABASE_URL_TEST: test,
    DATABASE_URL_MIGRATIONS: test,
    DATABASE_URL_APP: "",
    DATABASE_URL_PUBLIC: publicUrl.href,
    DATABASE_URL: "",
    PGHOST: "", PGUSER: "", PGDATABASE: "", PGPORT: "", PGPASSWORD: "",
    SUPABASE_DB_CA_CERT: "",
  };
}
