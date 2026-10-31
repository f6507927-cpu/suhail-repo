import { cliConnection } from "../../scripts/db/connection";
import { execFileSync } from "node:child_process";
import { stockTestEnvironment } from "./environment";

// Migrations intentionally create NOLOGIN roles. This disposable loopback-only
// harness exercises a real public login, rather than bypassing identity checks.
if (process.env.NODE_ENV !== "test") throw new Error("Stock browser setup is test-only");
const env = { ...process.env, ...stockTestEnvironment() };
Object.assign(process.env, env);
execFileSync("pnpm", ["db:migrate"], { env, stdio: "inherit" });
execFileSync("pnpm", ["db:seed:demo", "--test"], { env, stdio: "inherit" });
// Only after migrations (and the seed) may this disposable role log in.
const client = cliConnection("DATABASE_URL_TEST");
try { await client.unsafe("alter role suhail_public login"); }
finally { await client.end(); }
