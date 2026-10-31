import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { security } from "../db/schema/market";
import { methodology, methodologyVersion } from "../db/schema/methodology";
import { editorialSetting } from "../db/schema/editorial";
import { jobRun } from "../db/schema/accounts";
import { getJobsEnv } from "../env/jobs-env";
import { jobMutation, type Mutation } from "../ingest/sec/ingest";
import { screenSecurity, isExample } from "../screening/service";
import { requireFinancial } from "../lib/financial/persistence";
import { audit, type Tx } from "../lib/auth/audit";
import type { BulkResult, JobSummary, ScreenResult } from "../screening/contracts";
import { idSchema } from "../lib/financial/service";

export const NO_PRODUCTION_METHODOLOGY = "No production methodology to screen with";
const cursorSchema = z.object({
  targets: z.array(z.object({ securityId: z.uuid(), methodologyVersionId: z.uuid() })),
  next: z.number().int().nonnegative(), asOf: z.iso.date(),
  log: z.array(z.object({ securityId: z.string(), methodologyVersionId: z.string(), runId: z.string(), unchanged: z.boolean() })),
});
type Worker = (securityId: string, versionId: string, options: { asOf: string; trigger: string }, mutate: Mutation) => Promise<ScreenResult>;

/** Non-test selection is independent of SITE_MODE: preview is not a demo bypass. */
export async function screenVersions(tx: Tx) {
  const all = await tx.select({ v: methodologyVersion, m: methodology }).from(methodologyVersion)
    .innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id)).orderBy(asc(methodologyVersion.id));
  const localTests = process.env.NODE_ENV === "test"; // DB test guard enforces disposable loopback.
  const eligible = all.filter(({ m, v }) => localTests || !isExample(m, v));
  if (!localTests && !eligible.some(({ v }) => v.production_enabled)) return [];
  const [setting] = await tx.select().from(editorialSetting).where(eq(editorialSetting.setting_key, "editorial"));
  return eligible.filter(({ v }) => v.production_enabled || v.id === setting?.default_shariah_methodology_version_id).map(({ v }) => v.id);
}
export async function runScreenBatch(id?: string, mutate: Mutation = jobMutation, worker: Worker = screenSecurity, now = () => new Date()): Promise<BulkResult> {
  // Check BEFORE a job row, cursor update, audit write or screening is attempted.
  const versionIds = await mutate(tx => screenVersions(tx));
  if (!versionIds.length) return { message: NO_PRODUCTION_METHODOLOGY,
    summary: { status: "skipped", processed: 0, failed: 0, unchanged: 0, inserted: 0 } };
  const run = await mutate(async (tx, actor) => {
    if (id) {
      const [r] = await tx.select().from(jobRun).where(and(eq(jobRun.id, idSchema.parse(id)),
        eq(jobRun.job_name, "screen-universe"))).for("update");
      requireFinancial(r && r.status !== "completed", "Resumable screening job not found");
      return r;
    }
    const rows = await tx.select({ id: security.id }).from(security).where(eq(security.in_universe, true)).orderBy(asc(security.id));
    const started = now();
    const [r] = await tx.insert(jobRun).values({ job_name: "screen-universe", status: "running",
      started_at: started, created_by: actor?.id,
      cursor: { targets: rows.flatMap(s => versionIds.map(v => ({ securityId: s.id, methodologyVersionId: v }))),
        next: 0, asOf: started.toISOString().slice(0, 10), log: [] },
      counts: { processed: 0, failed: 0, unchanged: 0, inserted: 0 }, errors: [] }).returning();
    await audit(tx, actor, { event_type: "screening_run", entity_name: "job_run", entity_id: r.id, summary: "Universe screening started" });
    return r;
  });
  const cursor = cursorSchema.parse(run.cursor);
  requireFinancial(cursor.next <= cursor.targets.length, "Invalid screening cursor");
  const counts = { processed: run.counts?.processed ?? 0, failed: run.counts?.failed ?? 0,
    unchanged: run.counts?.unchanged ?? 0, inserted: run.counts?.inserted ?? 0 };
  const errors = [...run.errors ?? []];
  const end = Math.min(cursor.targets.length, cursor.next + getJobsEnv().JOB_BATCH_SIZE);
  const save = async () => mutate(async (tx, actor) => {
    const completed = cursor.next >= cursor.targets.length;
    await tx.update(jobRun).set({ cursor, counts, errors,
      status: completed ? "completed" : cursor.next < end ? "running" : "paused",
      finished_at: completed ? now() : null,
      timings: { elapsed_ms: now().getTime() - run.started_at!.getTime() } }).where(eq(jobRun.id, run.id));
    await audit(tx, actor, { event_type: "screening_run", entity_name: "job_run", entity_id: run.id,
      summary: "Universe screening checkpoint saved", details: { next: cursor.next } });
  });
  while (cursor.next < end) {
    const target = cursor.targets[cursor.next];
    try {
      const [s] = await mutate(tx => tx.select().from(security).where(eq(security.id, target.securityId)));
      if (s?.in_universe) {
        const result = await worker(target.securityId, target.methodologyVersionId, { asOf: cursor.asOf, trigger: "job" }, mutate);
        counts[result.unchanged ? "unchanged" : "inserted"]++;
        cursor.log.push({ ...target, ...result });
      }
      counts.processed++;
    } catch {
      counts.failed++;
      errors.push({ ...target, error: "Screening failed; inspect the security inputs and methodology" });
    }
    cursor.next++;
    // Deliberately outside the per-security catch: a lost checkpoint aborts for resume.
    await save();
  }
  if (!cursor.targets.length) await save();
  const summary: JobSummary = { ...counts, status: cursor.next >= cursor.targets.length ? "completed" : "paused" };
  return { jobId: run.id, summary };
}
export async function screenUniverse(id?: string, mutate: Mutation = jobMutation): Promise<BulkResult> {
  let result = await runScreenBatch(id, mutate);
  while (result.summary.status === "paused") result = await runScreenBatch(result.jobId, mutate);
  return result;
}
