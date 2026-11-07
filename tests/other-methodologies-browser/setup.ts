import { cliConnection } from "../../scripts/db/connection";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { screenSecurity } from "../../src/screening/service";

// D-174 browser fixture only, on the disposable loopback database prepared by
// tests/search-browser/setup.ts. Publishes the synthetic EX-B example as a
// second production-enabled methodology. Production prerequisites (D-93) are
// bypassed with replica triggers in THIS test database only; never elsewhere.
if (process.env.NODE_ENV !== "test") throw new Error("Other-methodologies browser setup is test-only");
const client = cliConnection("DATABASE_URL_TEST");
try {
  const db = drizzle(client, { schema });
  const [exB] = await db.select().from(schema.methodologyVersion).where(eq(schema.methodologyVersion.version_label, "EX-B v1.0"));
  if (!exB?.is_demo) throw new Error("Expected the synthetic EX-B fixture");
  await client.begin(async sql => {
    await sql`set local session_replication_role = replica`;
    await sql`update app.methodology_version set production_enabled = true, is_public = true where id = ${exB.id}`;
  });
  for (const slug of ["demo-fixa", "demo-fixc"]) {
    const [s] = await db.select().from(schema.security).where(eq(schema.security.slug, slug));
    await db.transaction(tx => screenSecurity(s.id, exB.id, { asOf: "2026-10-16", trigger: "demo-seed" }, work => work(tx, null)));
  }
} finally { await client.end(); }
