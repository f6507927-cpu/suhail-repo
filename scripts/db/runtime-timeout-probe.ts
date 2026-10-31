import { dbPublic } from "../../src/db/public";
import { dbApp } from "../../src/db/app";
import { databaseConnectionOptions } from "../../src/db/connection-url";

let approved = true;
for (const [name, key, db] of [
  ["dbPublic", "DATABASE_URL_PUBLIC", dbPublic],
  ["dbApp", "DATABASE_URL_APP", dbApp],
] as const) {
  let connected = false;
  try {
    // Reuse the production target validator; additionally require the approved
    // Session port (D-139). Never print the parsed connection or driver errors.
    const options = databaseConnectionOptions(key);
    if (options.port.length !== 1 || options.port[0] !== 5432)
      throw new Error("Session pooler port required");
    const statement = await db.$client.unsafe("show statement_timeout");
    connected = true; // The runtime's current_user check has also succeeded.
    const idle = await db.$client.unsafe("show idle_in_transaction_session_timeout");
    const statementTimeout = String(statement[0]?.statement_timeout);
    const idleTimeout = String(idle[0]?.idle_in_transaction_session_timeout);
    const accepted = statementTimeout === "10s" && idleTimeout === "10s";
    approved &&= accepted;
    console.log(JSON.stringify({
      client: name, sessionPort: 5432, connected,
      statement_timeout: statementTimeout,
      idle_in_transaction_session_timeout: idleTimeout,
      candidateAccepted: accepted,
    }));
  } catch {
    approved = false;
    console.log(JSON.stringify({
      client: name, sessionPort: 5432, connected,
      candidateAccepted: false,
      blocker: "Connection, runtime role verification, or effective-setting check failed",
    }));
  } finally {
    try { await db.$client.end({ timeout: 0 }); } catch { /* Sanitized refusal above. */ }
  }
}
if (!approved) {
  console.error("STOP: timeout candidate is not approved. No runtime settings or live role settings were changed.");
  process.exitCode = 1;
}
