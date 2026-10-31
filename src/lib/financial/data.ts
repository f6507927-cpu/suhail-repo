import "server-only";
import { desc } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { company, security, financialPeriod, financialFact, source, businessSegment, priceBar } from "../../db/schema/market";
import { analystProfile, jobRun } from "../../db/schema/accounts";
import type { FinancialAdminData } from "./contracts";
import { annotateSecChanges } from "./flags";

/** Private callers must perform requireRole before this read. Never used by public ISR. */
export async function getFinancialAdminData(): Promise<FinancialAdminData> {
  const [securities, companies, periods, facts, sources, segments, prices, analysts, jobs] = await Promise.all([
    dbApp.select().from(security), dbApp.select().from(company), dbApp.select().from(financialPeriod),
    dbApp.select().from(financialFact).orderBy(desc(financialFact.created_at), desc(financialFact.id)),
    dbApp.select().from(source), dbApp.select().from(businessSegment),
    dbApp.select().from(priceBar).orderBy(desc(priceBar.date), desc(priceBar.created_at)),
    dbApp.select().from(analystProfile), dbApp.select().from(jobRun).orderBy(desc(jobRun.created_at)),
  ]);
  return { guidanceAsOf: new Date().toISOString().slice(0, 10), securities, companies, periods, sources, segments, prices, analysts, jobs,
    facts: annotateSecChanges(facts) };
}
