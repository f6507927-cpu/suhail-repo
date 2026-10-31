import { defineConfig } from "drizzle-kit";
import { databaseConnectionOptions } from "./src/db/connection-url";
import { databaseTls } from "./src/db/tls";

const needsConnection = process.argv.some((arg) =>
  ["studio", "migrate", "push", "pull"].includes(arg),
);
const credentials = () => {
  const options = databaseConnectionOptions("DATABASE_URL_MIGRATIONS");
  return {
    host: options.host[0], port: options.port[0], user: options.username,
    password: options.password(), database: options.database,
    ssl: databaseTls("DATABASE_URL_MIGRATIONS", options.host[0]),
  };
};
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  schemaFilter: ["app"],
  ...(needsConnection
    ? { dbCredentials: credentials() }
    : {}),
});
