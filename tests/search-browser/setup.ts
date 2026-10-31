import { cliConnection } from "../../scripts/db/connection";
import { seedDemoData } from "../../scripts/db/seed-demo";
import { applyMigrations } from "../../scripts/db/migrate";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";

// Real Next routes + a real public login on disposable PostgreSQL only.
// No runtime auth bypass; the isolated Next copy uses the TEST connection parser.
if (process.env.NODE_ENV !== "test") throw new Error("Search browser setup is test-only");
const client = cliConnection("DATABASE_URL_TEST");
try {
  await applyMigrations(client);
  await seedDemoData(client);
  await client.unsafe("alter role suhail_public login");
  const db = drizzle(client, { schema });
  const [s] = await db.select().from(schema.security).where(eq(schema.security.slug, "demo-new"));
  await db.update(schema.company).set({ name_ar: "أبل إيمان آفاق مدرسة فتى مـدّ" }).where(eq(schema.company.id, s.company_id!));
} finally { await client.end(); }
