import { cliConnection } from "../../scripts/db/connection";

if (process.env.NODE_ENV !== "test") throw new Error("Other-methodologies cleanup is test-only");
const sql = cliConnection("DATABASE_URL_TEST");
try {
  // Symmetric with the pre-existing fixture override, confined to its demo row
  // and this validated disposable database. Do not broaden runtime governance.
  await sql.begin(async tx => {
    await tx`set local session_replication_role = replica`;
    await tx`update app.methodology_version set production_enabled = false
      where is_demo = true and version_label = 'EX-B v1.0'`;
  });
} finally { await sql.end(); }
