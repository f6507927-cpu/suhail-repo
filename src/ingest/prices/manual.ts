import "server-only";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { priceBar } from "../../db/schema/market";
import type { FinancialCommand } from "../../lib/financial/contracts";

/** Manual provider write boundary; audited persistence remains in the service. */
export function manualCloseCommand(securityId: string, data: Record<string, unknown>): FinancialCommand {
  return { operation: "price", securityId, data };
}

export interface PriceProvider {
  readonly name: string;
  readonly licenceNote: string;
  getCloses(securityId: string, from: string, to: string): Promise<(typeof priceBar.$inferSelect)[]>;
}
export const manualPriceProvider: PriceProvider = {
  name: "Manual entry",
  licenceNote: "Analyst-entered closes with a source label and URL; no licensed market feed.",
  getCloses: (id, from, to) => dbApp.select().from(priceBar).where(and(
    eq(priceBar.security_id, id), gte(priceBar.date, from), lte(priceBar.date, to))).orderBy(asc(priceBar.date)),
};
