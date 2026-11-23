import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { dbApp } from "@/db/app";
import { researchDraft, researchPacket, researchRefresh } from "@/db/schema/research";
import { analystProfile } from "@/db/schema/accounts";
import { ResearchReview } from "@/components/research";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { saveResearchEdits, transitionResearchDraft, regenerateResearchDraft, confirmResearchAnalystView } from "@/lib/research/actions";
import { readApprovedAnalystView } from "@/lib/research/stale-store";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return privatePageMetadata((await params).locale, "Review research");
}
export default async function ReviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const route = await params;
  const locale = route.locale === "en" ? "en" : "ar";
  const context = await requirePageRole(locale, localePath(locale, `/admin/research/${route.id}`));
  if (!z.uuid().safeParse(route.id).success) notFound();
  const [result] = await dbApp.select({ draft: researchDraft, packet: researchPacket.payload, changes: researchRefresh.changes }).from(researchDraft)
    .innerJoin(researchPacket, eq(researchPacket.id, researchDraft.packet_id))
    .leftJoin(researchRefresh, eq(researchRefresh.draft_id, researchDraft.id)).where(eq(researchDraft.id, route.id));
  if (!result) notFound();
  const [analyst] = await dbApp.select({ id: analystProfile.id }).from(analystProfile)
    .where(and(eq(analystProfile.user_id, context.user.id), eq(analystProfile.active, true)));
  const previousId = result.draft.previous_draft_id;
  const [baseline] = result.changes && previousId
    ? await dbApp.select({ text: researchDraft.analyst_text }).from(researchDraft).where(eq(researchDraft.id, previousId)) : [];
  const view = result.draft.state === "approved" ? await readApprovedAnalystView(result.draft.id) : null;
  return <ResearchReview key={`${result.draft.id}:${result.draft.text_hash}:${result.draft.state}`}
    locale={locale} draft={result.draft} packet={result.packet} activeAnalyst={!!analyst}
    revision={baseline?.text && result.changes ? { previous: baseline.text, changes: result.changes } : undefined}
    analystViewReview={view ? { required: view.analyst_view_review_required, runId: view.clear_run_id,
      clearAction: confirmResearchAnalystView } : undefined}
    saveAction={saveResearchEdits} transitionAction={transitionResearchDraft} regenerateAction={regenerateResearchDraft} />;
}
