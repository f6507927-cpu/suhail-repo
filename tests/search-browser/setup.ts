import { cliConnection } from "../../scripts/db/connection";
import { seedDemoData } from "../../scripts/db/seed-demo";
import { applyMigrations } from "../../scripts/db/migrate";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { screenSecurity } from "../../src/screening/service";

// Real Next routes + a real public login on disposable PostgreSQL only.
// No runtime auth bypass; the isolated Next copy uses the TEST connection parser.
if (process.env.NODE_ENV !== "test") throw new Error("Search browser setup is test-only");
const client = cliConnection("DATABASE_URL_TEST");
try {
  await applyMigrations(client);
  await seedDemoData(client);
  await client.unsafe("alter role suhail_public login");
  const db = drizzle(client, { schema });
  // UX-4: an additional synthetic share class uses the seeded company's
  // fabricated period/facts and a genuine engine-produced EX-A run.
  const [base] = await db.select().from(schema.security).where(eq(schema.security.slug, "demo-fixa"));
  // UX-5: a covered, genuinely passing fixture whose assigned profile is inactive.
  // The real loader must suppress its identity without suppressing the seal.
  const inactiveId = "c0e00000-0000-4000-8000-000000000005";
  await db.insert(schema.analystProfile).values({
    id: inactiveId, name_ar: "محلل اختباري غير نشط", name_en: "Inactive synthetic analyst", active: false, is_demo: true,
  }).onConflictDoNothing();
  const [withoutProfile] = await db.insert(schema.security).values({
    company_id: base.company_id, exchange_id: base.exchange_id, exchange_code: base.exchange_code,
    ticker: "FIXP", slug: "demo-covered-no-profile", coverage_analyst_id: inactiveId,
    in_universe: true, listing_status: "listed", is_demo: true,
  }).onConflictDoNothing({ target: schema.security.slug }).returning();
  const [defaultSetting] = await db.select().from(schema.editorialSetting).where(eq(schema.editorialSetting.setting_key, "editorial"));
  if (withoutProfile) await db.transaction(tx => screenSecurity(withoutProfile.id,
    defaultSetting.default_shariah_methodology_version_id!, { asOf: "2026-10-16", trigger: "demo-seed" }, work => work(tx, null)));
  // Explanatory UI only: does not alter any engine input, status or stored run.
  await db.update(schema.methodologyCriterion).set({
    explanation_ar: "شرح توضيحي اختباري للمعيار.", explanation_en: "Synthetic plain criterion explanation.",
  }).where(eq(schema.methodologyCriterion.methodology_version_id, defaultSetting.default_shariah_methodology_version_id!));
  const [apple] = await db.insert(schema.security).values({
    company_id: base.company_id, exchange_id: base.exchange_id, exchange_code: base.exchange_code,
    ticker: "AAPL", display_symbol: "AAPL", slug: "nasdaq-aapl",
    in_universe: true, listing_status: "listed", is_demo: true,
    demo_label: "SYNTHETIC SEARCH FIXTURE — not a real Apple assessment",
  }).onConflictDoNothing({ target: schema.security.slug }).returning();
  if (apple) {
    const [setting] = await db.select().from(schema.editorialSetting).where(eq(schema.editorialSetting.setting_key, "editorial"));
    await db.transaction(tx => screenSecurity(apple.id, setting.default_shariah_methodology_version_id!, { asOf: "2026-10-16", trigger: "demo-seed" }, work => work(tx, null)));
  }
  const [s] = await db.select().from(schema.security).where(eq(schema.security.slug, "demo-new"));
  await db.update(schema.company).set({ name_ar: "أبل إيمان آفاق مدرسة فتى مـدّ" }).where(eq(schema.company.id, s.company_id!));
} finally { await client.end(); }
