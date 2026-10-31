import "server-only";
import { and, eq, asc } from "drizzle-orm";
import { security } from "../db/schema/market";
import { jobRun } from "../db/schema/accounts";
import { getJobsEnv } from "../env/jobs-env";
import { ingestSecurity, jobMutation, safeIngestError, type Mutation } from "../ingest/sec/ingest";
import { audit } from "../lib/auth/audit";
import { idSchema } from "../lib/financial/service";
import { requireFinancial } from "../lib/financial/persistence";

/** Each invocation commits one configured batch; resume processes the next batch. */
export async function runIngestBatch(id?: string, mutate: Mutation = jobMutation, ingest = ingestSecurity) {
  const size = getJobsEnv().JOB_BATCH_SIZE;
  const run = await mutate(async (tx, actor) => {
    if (id) {
      const [r] = await tx.select().from(jobRun).where(and(
        eq(jobRun.id, idSchema.parse(id)), eq(jobRun.job_name, "ingest-sec"))).for("update");
      requireFinancial(r && r.status !== "completed", "Resumable ingestion job not found");
      return r;
    }
    const rows = await tx.select({ id: security.id }).from(security)
      .where(eq(security.in_universe, true)).orderBy(asc(security.id));
    const [r] = await tx.insert(jobRun).values({ job_name: "ingest-sec", status: "running",
      cursor: { ids: rows.map(s => s.id), next: 0 }, counts: { processed: 0, failed: 0, inserted: 0 },
      errors: [], started_at: new Date(), created_by: actor?.id }).returning();
    await audit(tx, actor, { event_type: "data_ingest", entity_name: "job_run", entity_id: r.id,
      summary: "SEC ingestion job started" });
    return r;
  });
  const ids = run.cursor?.ids;
  requireFinancial(Array.isArray(ids) && ids.every(v => typeof v === "string"), "Invalid ingestion cursor");
  let next = Number(run.cursor?.next ?? 0);
  const counts = { processed: run.counts?.processed ?? 0, failed: run.counts?.failed ?? 0, inserted: run.counts?.inserted ?? 0 };
  const errors = [...run.errors ?? []];
  const end = Math.min(ids.length, next + size);
  for (; next < end;) {
    const securityId = String(ids[next]);
    try {
      const [s] = await mutate(tx => tx.select().from(security).where(eq(security.id, securityId)));
      if (s?.in_universe) counts.inserted += (await ingest(securityId, mutate)).inserted;
      counts.processed++;
    } catch (error) { counts.failed++; errors.push({ securityId, error: safeIngestError(error) }); }
    next++;
    await mutate(async (tx, actor) => {
      await tx.update(jobRun).set({ status: next >= ids.length ? "completed" : "paused",
        cursor: { ids, next }, counts, errors, timings: { elapsed_ms: Date.now() - (run.started_at?.getTime() ?? Date.now()) },
        finished_at: next >= ids.length ? new Date() : null })
        .where(eq(jobRun.id, run.id));
      await audit(tx, actor, { event_type: "data_ingest", entity_name: "job_run", entity_id: run.id,
        summary: "SEC ingestion checkpoint saved", details: { next } });
    });
  }
  if (!ids.length) await mutate(async (tx, actor) => {
    await tx.update(jobRun).set({ status: "completed", finished_at: new Date(), timings: { elapsed_ms: 0 } }).where(eq(jobRun.id, run.id));
    await audit(tx, actor, { event_type: "data_ingest", entity_name: "job_run", entity_id: run.id,
      summary: "SEC ingestion completed with empty universe" });
  });
  return run.id;
}

/** Step 8 manual runner drains the same resumable batches inside the request. */
export async function ingestUniverse(id?: string, mutate: Mutation = jobMutation) {
  let jobId = await runIngestBatch(id, mutate);
  for (;;) {
    const [run] = await mutate(tx => tx.select().from(jobRun).where(eq(jobRun.id, jobId)));
    requireFinancial(run, "Ingestion job not found");
    if (run.status === "completed") return {
      jobId, summary: { status: run.status, processed: run.counts?.processed ?? 0, failed: run.counts?.failed ?? 0,
        inserted: run.counts?.inserted ?? 0, unchanged: 0 },
    };
    jobId = await runIngestBatch(jobId, mutate);
  }
}
