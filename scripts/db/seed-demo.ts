import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import type { Sql } from "postgres";
import { pathToFileURL } from "node:url";
import * as schema from "../../src/db/schema";
import { goldenInput } from "../../src/engine/__fixtures__/synthetic";
import { screenSecurity } from "../../src/screening/service";
import { demoSeedConnection } from "./connection";
import { LOOPBACK_HOSTS } from "./test-target";
import { seedDatabase } from "./seed";
import type { Tx } from "../../src/lib/auth/audit";

export function assertDemoMode(mode = process.env.SITE_MODE) {
  if (mode === "live") throw new Error("Demo seed refuses SITE_MODE=live");
  if (mode !== "preview") throw new Error("Demo seed requires SITE_MODE=preview");
}
export const DEMO_CASES = [
  { slug: "demo-fixa", name: "Fixture Alpha", ticker: "FIXA", outcome: "pass", covered: true },
  { slug: "demo-fixb", name: "Fixture Beta", ticker: "FIXB", outcome: "review", covered: false },
  { slug: "demo-fixc", name: "Fixture Gamma", ticker: "FIXC", outcome: "fail", covered: true },
  { slug: "demo-fixd", name: "Fixture Delta", ticker: "FIXD", outcome: "insufficient", covered: false },
  { slug: "demo-fixu", name: "Fixture Uncovered", ticker: "FIXU", outcome: "pass", covered: false },
  { slug: "demo-new", name: "Fixture New", ticker: "FIXN", outcome: null, covered: false },
  { slug: "demo-hidden", name: "Fixture Hidden", ticker: "FIXH", outcome: null, covered: false },
] as const;

/** Explicit developer command, never called by page loads, builds or live jobs. */
export async function seedDemoData(client: Sql) {
  assertDemoMode();
  if (!client.options.host.length || !client.options.host.every(host =>
    LOOPBACK_HOSTS.some(allowed => allowed === host || (allowed === "[::1]" && host === "::1"))
  )) throw new Error("Demo seed requires an isolated loopback database");
  await seedDatabase(client);
  const db = drizzle(client, { schema });
  return db.transaction(createDemoFixtures);
}

export async function createDemoFixtures(tx: Tx) {
    assertDemoMode();
    const [version] = await tx.select().from(schema.methodologyVersion)
      .where(eq(schema.methodologyVersion.methodology_name, "Example Methodology A")).limit(1);
    if (!version?.is_demo || !version.is_public) throw new Error("Demo seed requires the public EX-A fixture");
    const [setting] = await tx.select().from(schema.editorialSetting).where(eq(schema.editorialSetting.setting_key, "editorial"));
    if (setting?.default_shariah_methodology_version_id !== version.id) throw new Error("Demo seed requires EX-A as the isolated development default; no default was changed");
    const [exchange] = await tx.select().from(schema.exchange).where(eq(schema.exchange.code, "NASDAQ"));
    const [existingAnalyst] = await tx.select().from(schema.analystProfile).where(eq(schema.analystProfile.name_en, "Fixture Research Analyst")).limit(1);
    const analyst = existingAnalyst ?? (await tx.insert(schema.analystProfile).values({
      name_ar: "", name_en: "Fixture Research Analyst", title_en: "Synthetic coverage profile",
      credentials: "Synthetic fixture; not a real analyst", is_demo: true, active: true,
    }).returning())[0];
    const results = [];
    for (const fixture of DEMO_CASES) {
      const [existing] = await tx.select().from(schema.security).where(eq(schema.security.slug, fixture.slug)).limit(1);
      let security = existing;
      if (existing) {
        const [company] = await tx.select().from(schema.company).where(eq(schema.company.id, existing.company_id!));
        if (!existing.is_demo || !company?.is_demo || company.name !== `${fixture.name} Co`) throw new Error("Demo slug collision; refusing to alter existing data");
      } else {
        const [company] = await tx.insert(schema.company).values({ name: `${fixture.name} Co`, sector_label: "Fixture synthetic sector", is_demo: true }).returning();
        [security] = await tx.insert(schema.security).values({
          company_id: company.id, exchange_id: exchange.id, exchange_code: exchange.code,
          ticker: fixture.ticker, display_symbol: fixture.ticker, slug: fixture.slug,
          in_universe: fixture.slug !== "demo-hidden", listing_status: "listed",
          coverage_analyst_id: fixture.covered ? analyst.id : null, is_demo: true,
          demo_label: "SYNTHETIC / DEMO — no real issuer",
        }).returning();
      }
      if (!fixture.outcome) { results.push({ slug: fixture.slug, securityId: security.id }); continue; }
      const [existingPeriod] = await tx.select().from(schema.financialPeriod).where(and(eq(schema.financialPeriod.company_id, security.company_id!), eq(schema.financialPeriod.is_latest, true))).limit(1);
      if (!existingPeriod) {
        const input = goldenInput("A", fixture.outcome);
        const [source] = await tx.insert(schema.source).values({
          label: `${fixture.name} fabricated filing`, source_type: "regulatory_filing",
          document_title: `${fixture.name} synthetic annual filing`, document_reference: `FIXTURE-${fixture.ticker}-2025`,
          source_url: "https://example.invalid/synthetic-filing", reporting_period: "2025", is_demo: true, is_synthetic: true,
        }).returning();
        const [period] = await tx.insert(schema.financialPeriod).values({
          company_id: security.company_id!, period_type: "annual", fiscal_year: 2025,
          fiscal_period_label: "Fixture FY2025", period_end: "2025-12-31", reported_date: "2026-02-01",
          currency: "USD", is_latest: true, source_id: source.id, filing_reference: source.document_reference, is_demo: true,
        }).returning();
        await tx.insert(schema.financialFact).values(input.facts.map((fact) => ({
          company_id: security.company_id!, period_id: period.id, line_item: fact.lineItem,
          label: fact.lineItem, value: fact.value, input_state: fact.inputState, confidence_tier: fact.confidenceTier,
          currency: "USD", source_id: source.id, is_current: true, is_demo: true,
        })));
        await tx.insert(schema.businessSegment).values(input.segments.map((segment) => {
          if (!schema.businessSegment.activity_category.enumValues.some(category => category === segment.activityCategory)) throw new Error("Invalid synthetic activity category");
          return {
          company_id: security.company_id!, period_id: period.id, segment_name: segment.segmentName,
          activity_category: segment.activityCategory as typeof schema.businessSegment.$inferInsert["activity_category"], revenue_amount: segment.revenueAmount,
          revenue_share: segment.revenueShare, input_state: segment.inputState, confidence_tier: segment.confidenceTier,
          source_id: source.id, is_demo: true,
        }; }));
      }
      const run = await screenSecurity(security.id, version.id, { asOf: "2026-10-16", trigger: "demo-seed" }, (work) => work(tx, null));
      results.push({ slug: fixture.slug, securityId: security.id, ...run });
    }
    return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertDemoMode(); // Refuse before opening any connection.
  const client = demoSeedConnection(process.argv.includes("--test") ? "DATABASE_URL_TEST" : "DATABASE_URL_MIGRATIONS");
  try { console.log(JSON.stringify(await seedDemoData(client))); }
  catch { console.error("Demo seed failed; check the isolated preview database and EX-A default. No credentials were logged."); process.exitCode = 1; }
  finally { await client.end(); }
}
