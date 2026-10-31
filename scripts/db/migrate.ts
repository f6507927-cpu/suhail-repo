import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { cliConnection } from "./connection";
import { pathToFileURL } from "node:url";
import type { Sql } from "postgres";

export async function applyMigrations(client: Sql) {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const client = cliConnection("DATABASE_URL_MIGRATIONS");
  try {
    await applyMigrations(client);
    console.log("Database migrations applied.");
  } finally {
    await client.end();
  }
}
