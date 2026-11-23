import "server-only";
import { eq, sql } from "drizzle-orm";
import { renderFigures } from "../../ai/research/draft";
import type { ResearchDraft } from "../../ai/research/draft";
import type { Bilingual, ResearchPacket } from "../../ai/research/contracts";
import { validateResearchDraft } from "../../ai/research/validators";
import type { PublicationKind, PublicResearchDisplay } from "../../stock/research-public-types";
import { dbApp } from "../../db/app";
import { company } from "../../db/schema/market";
import { audit, type AppUser, type Tx } from "../auth/audit";
import { assertActiveAnalyst, configuredSettings, researchWriteLock } from "./access";
import { loadResearchPacket, StoredResearchPacketLoader } from "./loader";
import { latestResearchFlag, updateStalenessForDraft } from "./stale-store";
import { blockingCount, lockedDraft } from "./store";
import { PUBLIC_RESEARCH_COPY_APPROVED } from "./publication-policy";

function publicDisplay(draft: ResearchDraft, packet: ResearchPacket): PublicResearchDisplay {
  const prose = (value: Bilingual): Bilingual => {
    const render = (locale: keyof Bilingual) => renderFigures(value[locale], packet, locale).replace(/\{\{cite:[^{}]+\}\}/g, "");
    return { ar: render("ar"), en: render("en") };
  };
  const citations = new Map<string, string>();
  for (const citation of draft.citations) {
    const item = packet.items.find(i => i.id === citation.item_id && i.source.id === citation.source_id);
    if (!item) throw new Error("Research citation no longer resolves");
    citations.set(item.source.id, item.source.label);
  }
  return {
    plain_summary: draft.plain_summary.map(prose),
    analyst_view: {
      thesis: draft.analyst_view.reasons.map(entry => prose(entry.text)),
      evidence: draft.financial_highlights.map(entry => prose(entry.text)),
      risks: draft.risks.map(entry => prose(entry.text)),
      valuation: prose(draft.valuation_discussion),
    },
    methodologies: packet.screenings.map(run => ({ slug: run.methodology, label: run.label, status: run.status })),
    citations: [...citations].map(([source_id, label]) => ({ source_id, label })),
  };
}

type PublicationState = {
  id: string;
  draft_id: string;
  kind: PublicationKind;
  triggers: string[];
  withdrawal_reason: string | null;
};

export async function currentPublication(securityId: string, db: Pick<Tx, "execute"> = dbApp) {
  const [publication] = await db.execute<PublicationState>(sql`
    select id::text,draft_id,kind,triggers,withdrawal_reason
    from app.research_publication_current where security_id=${securityId}
  `);
  return publication ?? null;
}

export async function recordPublication(tx: Tx, actor: AppUser, draftId: string, kind: PublicationKind, reason: string | null) {
  await tx.execute(researchWriteLock);
  await assertActiveAnalyst(tx, actor.id);
  const { row, scope } = await configuredSettings(tx);
  if (!row.ai_research_publishing) throw new Error("Research publishing gate is off");
  const { draft, packet } = await lockedDraft(tx, draftId);
  if (draft.state !== "approved" || !draft.analyst_text || blockingCount(draft.validation_results))
    throw new Error("An approved research draft without blockers is required");
  const now = new Date();
  if ((await latestResearchFlag(tx, draftId))?.outdated) throw new Error("Research draft is outdated");
  await updateStalenessForDraft(tx, draftId, now);
  if ((await latestResearchFlag(tx, draftId))?.outdated) throw new Error("Research draft is outdated");
  const latest = await loadResearchPacket(draft.security_id, now.toISOString(), new StoredResearchPacketLoader(tx, now.toISOString()));
  const issuers = await tx.select({ name: company.name }).from(company).where(eq(company.is_demo, false));
  if (blockingCount(validateResearchDraft(draft.analyst_text, packet, {
    now: now.toISOString(), latest_packet: latest, max_packet_age_days: scope.max_packet_age_days,
    max_financial_age_days: scope.max_financial_age_days, known_issuers: issuers.map(row => row.name),
    stage: "publish", context_line_resolved: true, disclosure_resolved: PUBLIC_RESEARCH_COPY_APPROVED,
  }))) throw new Error("Publication validation is blocked");
  const before = await currentPublication(draft.security_id, tx);
  const display = kind === "withdrawn" ? {} : publicDisplay(draft.analyst_text, packet);
  // The trigger derives security, approving analyst, approval date, data date,
  // event date and update reasons instead of trusting submitted form values.
  await tx.execute(sql`insert into app.research_publication_event(draft_id,actor_id,kind,withdrawal_reason,display)
    values (${draftId},${actor.id},${kind},${reason},${JSON.stringify(display)}::jsonb)`);
  const after = await currentPublication(draft.security_id, tx);
  await audit(tx, actor, { event_type: "research_publication", entity_name: "research_draft", entity_id: draftId,
    summary: `Research ${kind}`, details: { before, after } });
}
