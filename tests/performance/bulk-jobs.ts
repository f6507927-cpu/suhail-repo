import type { Mutation } from "../../src/ingest/sec/ingest";
export class FinancialError extends Error {}
export function revalidatePath() {}
async function bulk(_id: string | undefined, mutate: Mutation) {
  for (let index = 0; index < 3; index++) await mutate(async () => undefined);
  return {
    jobId: "fixture-job",
    summary: { processed: 3, failed: 0, unchanged: 0, inserted: 3, status: "completed" as const },
  };
}
export const ingestUniverse = bulk;
export const screenUniverse = bulk;
export function screenSecurity() { throw new Error("Not used by bulk fixture"); }
export function verifyRun() { throw new Error("Not used by bulk fixture"); }
