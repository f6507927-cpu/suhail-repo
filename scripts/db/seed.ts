import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import type { Sql } from "postgres";
import * as schema from "../../src/db/schema";
import { cliConnection } from "./connection";
import { criteriaFixtures } from "./fixtures";

export async function seedDatabase(client: Sql) {
  const db = drizzle(client, { schema });
  await db.transaction(async (tx) => {
    // Serialize seeds without modifying existing fixture/governance records.
    await tx.execute("SELECT pg_advisory_xact_lock(736042)");
    for (const [code, mic] of [
      ["NASDAQ", "XNAS"],
      ["NYSE", "XNYS"],
    ]) {
      await tx
        .insert(schema.exchange)
        .values({
          code,
          name: code,
          mic,
          country: "US",
          timezone: "America/New_York",
          default_currency: "USD",
          regulator: "SEC",
          is_demo: false,
        })
        .onConflictDoNothing({ target: schema.exchange.code });
    }
    for (const example of ["A", "B"] as const) {
      const name = `Example Methodology ${example}`;
      const slug = `example-${example.toLowerCase()}`;
      await tx
        .insert(schema.methodology)
        .values({
          name,
          slug,
          short_label: `EX-${example}`,
          official_or_inspired: "internal_example",
          licensing_status: "internal",
          production_enabled: false,
          current_version_label: `EX-${example} v1.0`,
          is_demo: true,
        })
        .onConflictDoNothing({ target: schema.methodology.slug });
      const [methodology] = await tx
        .select()
        .from(schema.methodology)
        .where(eq(schema.methodology.slug, slug));
      await tx
        .insert(schema.methodologyVersion)
        .values({
          methodology_id: methodology.id,
          methodology_name: name,
          version: "1.0",
          version_label: `EX-${example} v1.0`,
          effective_date: "2026-01-01",
          workflow_status: "draft",
          is_public: true,
          production_enabled: false,
          is_demo: true,
          purification_treatment:
            example === "A"
              ? {
                  formula:
                    "non-permissible revenue ÷ total revenue × dividend received",
                  inputs: [
                    "non_permissible_revenue",
                    "total_revenue",
                    "dividend_received",
                  ],
                  example_ratio: 0.03,
                  confidence_tier: "Estimated",
                  verified: false,
                }
              : null,
        })
        .onConflictDoNothing({
          target: [
            schema.methodologyVersion.methodology_id,
            schema.methodologyVersion.version,
          ],
        });
      const [version] = await tx
        .select()
        .from(schema.methodologyVersion)
        .where(
          and(
            eq(schema.methodologyVersion.methodology_id, methodology.id),
            eq(schema.methodologyVersion.version, "1.0"),
          ),
        );
      for (const criterion of criteriaFixtures(example)) {
        const existing = await tx
          .select({ id: schema.methodologyCriterion.id })
          .from(schema.methodologyCriterion)
          .where(
            and(
              eq(
                schema.methodologyCriterion.methodology_version_id,
                version.id,
              ),
              eq(schema.methodologyCriterion.sort_order, criterion.sort_order!),
            ),
          );
        if (!existing.length)
          await tx.insert(schema.methodologyCriterion).values({
            ...criterion,
            methodology_id: methodology.id,
            methodology_version_id: version.id,
          });
      }
      if (example === "A") {
        await tx
          .insert(schema.editorialSetting)
          .values({
            setting_key: "editorial",
            default_shariah_methodology_version_id: version.id,
            allow_ineligible_editor_pick: false,
            is_demo: false,
          })
          .onConflictDoNothing({ target: schema.editorialSetting.setting_key });
      }
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const client = cliConnection("DATABASE_URL_MIGRATIONS");
  try {
    await seedDatabase(client);
    console.log("Reference fixtures seeded.");
  } finally {
    await client.end();
  }
}
