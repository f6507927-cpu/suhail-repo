import "server-only";
import { eq } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { researchDraft } from "../../db/schema/research";
import { updateStalenessForDraft } from "./stale-store";

/** Record flags only; the job never requests drafts or calls a provider. */
export async function runResearchStaleness(now = new Date(), db: Pick<typeof dbApp, "select" | "transaction"> = dbApp) {
  const drafts = await db.select({ id: researchDraft.id }).from(researchDraft)
    .where(eq(researchDraft.state, "approved")).orderBy(researchDraft.id);
  let updated = 0;
  for (const { id } of drafts) if (await db.transaction(tx => updateStalenessForDraft(tx, id, now))) updated++;
  return { inspected: drafts.length, updated };
}
