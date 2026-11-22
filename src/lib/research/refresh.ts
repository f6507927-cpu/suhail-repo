import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { researchDraft, researchRefresh } from "../../db/schema/research";
import { compareResearchPackets, type PacketChange } from "../../ai/research/changes";
import type { ResearchPacket } from "../../ai/research/contracts";
import type { AppUser, Tx } from "../auth/audit";
import { assertActiveAnalyst, createRequestedDraft, lockedDraft, researchWriteLock } from "./store";
import { latestApprovedResearchId, latestResearchFlag } from "./stale-store";

/** The queue offers only manual requests linked to the latest approved version. */
export async function createRefreshRequest(tx: Tx, actor: AppUser, packet: ResearchPacket, previousId: string) {
  await tx.execute(researchWriteLock);
  await assertActiveAnalyst(tx, actor.id);
  if (await latestApprovedResearchId(tx, packet.security.id) !== previousId) throw new Error("Reload the latest approved draft");
  const { draft: baseline, packet: oldPacket } = await lockedDraft(tx, previousId);
  if (!baseline.analyst_text) throw new Error("Approved text is required");
  const flag = await latestResearchFlag(tx, previousId);
  if (!flag?.outdated) throw new Error("Approved draft is not outdated");
  const [active] = await tx.select({ id: researchRefresh.draft_id }).from(researchRefresh)
    .innerJoin(researchDraft, eq(researchDraft.id, researchRefresh.draft_id)).where(and(
      eq(researchDraft.security_id, packet.security.id),
      inArray(researchDraft.state, ["requested", "generated", "in_review", "changes_requested", "edited"]))).limit(1);
  if (active) throw new Error("A refresh is already in progress");
  const changes: PacketChange[] = compareResearchPackets(oldPacket, packet);
  if (flag.outdated_reasons.includes("aged"))
    changes.push({ item_id: "packet.age", type: "changed", old_value: true, new_value: false, trigger: "age" });
  const draft = await createRequestedDraft(tx, actor, packet, "", previousId, { changes });
  return { draft, refresh: { previous: baseline.analyst_text, changes } };
}
