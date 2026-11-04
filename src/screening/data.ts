import "server-only";
import { eq, asc, desc } from "drizzle-orm";
import { dbApp } from "../db/app";
import { methodology, methodologyVersion } from "../db/schema/methodology";
import { screeningRun, screeningCriterionResult, screeningUnknown } from "../db/schema/screening";
import { jobRun } from "../db/schema/accounts";
import { isExample } from "./service";
import { idSchema } from "../lib/financial/service";
import { requireFinancial } from "../lib/financial/persistence";
import type { ScreeningAdminData, RunDetail } from "./contracts";
import { company, security } from "../db/schema/market";
import { englishCompanyName } from "../lib/format";

/** Only call after the page/action's requireRole guard. No public list-all API. */
export async function getScreeningAdminData(): Promise<ScreeningAdminData> {
  const versions = await dbApp.select({ v: methodologyVersion, m: methodology }).from(methodologyVersion)
    .innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id));
  const runs = await dbApp.select().from(screeningRun).orderBy(desc(screeningRun.generated_at), desc(screeningRun.created_at));
  const jobs = await dbApp.select().from(jobRun).where(eq(jobRun.job_name, "screen-universe"));
  const unchanged: ScreeningAdminData["unchanged"] = [];
  for (const job of jobs) {
    const log = job.cursor?.log;
    if (Array.isArray(log)) for (const value of log) {
      if (value && typeof value === "object" && !Array.isArray(value) && value.unchanged === true &&
        typeof value.securityId === "string" && typeof value.methodologyVersionId === "string" && typeof value.runId === "string")
        unchanged.push({ securityId: value.securityId, methodologyVersionId: value.methodologyVersionId, runId: value.runId, jobId: job.id });
    }
  }
  return { versions: versions.filter(({ m, v }) => !isExample(m, v)).map(({ v, m }) => ({
    id: v.id, label: v.version_label ?? v.version, methodologyName: m.name,
  })), runs, unchanged };
}
export async function getRunDetail(id: string): Promise<RunDetail> {
  const [run] = await dbApp.select().from(screeningRun).where(eq(screeningRun.id, idSchema.parse(id)));
  requireFinancial(run, "Screening run not found");
  const criteria = await dbApp.select().from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, run.id))
    .orderBy(asc(screeningCriterionResult.sort_order));
  const unknowns = await dbApp.select().from(screeningUnknown).where(eq(screeningUnknown.screening_run_id, run.id));
  // D-148: never replace company_name inside a historical run or its hash.
  const [issuer] = await dbApp.select({ name: company.name, display_name_en: company.display_name_en })
    .from(security).innerJoin(company, eq(company.id, security.company_id)).where(eq(security.id, run.security_id));
  return { run, criteria, unknowns, companyDisplayNameEn: issuer ? englishCompanyName(issuer) : undefined };
}
