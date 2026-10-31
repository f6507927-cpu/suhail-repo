import { connectDatabase } from "../../src/db/connect";
import { testDatabaseUrl } from "./test-target";
import { databaseUrl } from "../../src/db/connection-url";

// Local, disposable PostgreSQL CI has no TLS. This exception never enters
// runtime clients and is restricted to loopback CLI/test hosts.
export function cliConnection(
  key: "DATABASE_URL_MIGRATIONS" | "DATABASE_URL_TEST",
) {
  return connectDatabase(
    key,
    {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 5,
    },
    key === "DATABASE_URL_TEST" ? testDatabaseUrl() : undefined,
  );
}

/** D-120: validate the effective CLI selection before creating any client. */
export function demoSeedConnection(key: "DATABASE_URL_MIGRATIONS" | "DATABASE_URL_TEST") {
  if (process.env.SITE_MODE !== "preview") throw new Error("Demo seed requires SITE_MODE=preview");
  const target = key === "DATABASE_URL_TEST" ? testDatabaseUrl() : process.env[key];
  // Reuse the strict parser/loopback policy; do not relax generic CLI guards.
  databaseUrl("DATABASE_URL_TEST", target);
  return cliConnection(key);
}
