import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { analystProfile } from "../../db/schema/accounts";
import { researchSetting } from "../../db/schema/research";
import type { Tx } from "../auth/audit";
import { scopeSettingsSchema } from "./workflow";

export const researchWriteLock = sql`select pg_advisory_xact_lock(73501948)`;
export async function assertActiveAnalyst(tx: Pick<Tx, "select">, actorId: string) {
  const [profile] = await tx.select({ id: analystProfile.id }).from(analystProfile)
    .where(and(eq(analystProfile.user_id, actorId), eq(analystProfile.active, true)));
  if (!profile) throw new Error("An active analyst profile is required");
}
export async function configuredSettings(db: Pick<Tx, "select"> = dbApp) {
  const [row] = await db.select().from(researchSetting).where(eq(researchSetting.id, 1));
  if (!row) throw new Error("Research settings are unavailable");
  return { row, scope: scopeSettingsSchema.parse({
    monthly_token_budget: row.monthly_token_budget, max_active_research_stocks: row.max_active_research_stocks,
    allowed_sectors: row.allowed_sectors, max_packet_age_days: row.max_packet_age_days,
    max_financial_age_days: row.max_financial_age_days, publication_age_days: row.publication_age_days,
    price_move_threshold_percent: row.price_move_threshold_percent === null ? null : Number(row.price_move_threshold_percent),
  }) };
}
