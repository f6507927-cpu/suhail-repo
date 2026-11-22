import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { researchSetting, researchStalenessEvent } from "../../db/schema/research";
import { analystViewRequired, detectStaleness, PASSING, type StaleReason } from "../../ai/research/staleness";
import type { ResearchPacket } from "../../ai/research/contracts";
import type { ResearchDraft } from "../../ai/research/draft";
import { audit, type AppUser, type Tx } from "../auth/audit";
import { assertActiveAnalyst, researchWriteLock } from "./access";
import { latestResearchFilings } from "./filings";

type ReadDb = Pick<Tx, "execute" | "select">;
type DefaultRun = { id: string; version_id: string; stop_id: string | null; status: string };
type Flag = Pick<typeof researchStalenessEvent.$inferSelect,
  "outdated" | "outdated_reasons" | "analyst_view_review_required" | "cleared_version_id" | "cleared_stop_id">;
const emptyFlag: Flag = { outdated: false, outdated_reasons: [], analyst_view_review_required: false,
  cleared_version_id: null, cleared_stop_id: null };

// app.public_settings names a version, not a family. A missing or ineligible
// run is not a pass. Ties prefer any non-pass rather than showing analyst text.
const defaultRun = sql`
  left join lateral (
    select r.id, r.status, r.methodology_version_id as version_id, (
      select stop.id from app.screening_run stop
      where stop.security_id = d.security_id and stop.methodology_version_id = r.methodology_version_id
        and not stop.is_demo and stop.status <> ${PASSING} and stop.generated_at >= coalesce(
          (select max((s->>'run_at')::timestamptz) from jsonb_array_elements(p.payload->'screenings') s
           where s->>'methodology'=m.slug and s->>'status'=${PASSING}),
          approval.occurred_at)
      order by stop.generated_at desc, stop.id desc limit 1
    ) as stop_id
    from app.public_settings ps join app.methodology_version v on v.id = ps.default_shariah_methodology_version_id
    join app.methodology m on m.id = v.methodology_id
    join app.screening_run r on r.methodology_version_id = v.id and r.security_id = d.security_id
    where not r.is_demo and m.production_enabled and v.production_enabled
      and not m.is_demo and not v.is_demo and not m.production_blocked and not v.production_blocked
    order by r.generated_at desc, (r.status <> ${PASSING}) desc, r.id desc limit 1
  ) live on true`;
const approvalJoin = sql`join lateral (
    select max(e.occurred_at) as occurred_at from app.research_review_event e
    where e.draft_id=d.id and e.to_state='approved'
  ) approval on approval.occurred_at is not null`;

async function approvedSnapshot(db: ReadDb, draftId: string) {
  const [row] = await db.execute<{ security_id: string; packet: ResearchPacket; approved_at: string;
    analyst_view: ResearchDraft["analyst_view"]; run: DefaultRun | null; flag: Flag | null }>(sql`
    select d.security_id, p.payload as packet, approval.occurred_at::text as approved_at,
      d.analyst_text->'analyst_view' as analyst_view,
      case when live.id is not null then to_jsonb(live) end as run,
      (select to_jsonb(f) - 'id' - 'draft_id' - 'occurred_at' from app.research_staleness_event f
       where f.draft_id=d.id order by f.id desc limit 1) as flag
    from app.research_draft d join app.research_packet p on p.id=d.packet_id
    ${approvalJoin} ${defaultRun}
    where d.id=${draftId} and d.state='approved'
  `);
  return row;
}

/** Private read, deliberately uncached. Never returns raw approved text. */
export async function readApprovedAnalystView(draftId: string, db: ReadDb = dbApp) {
  const row = await approvedSnapshot(db, draftId);
  if (!row) return null;
  const hidden = analystViewRequired(row.run ?? undefined, row.flag ?? undefined);
  return { analyst_view: hidden ? null : row.analyst_view, analyst_view_review_required: hidden,
    clear_run_id: hidden && row.run?.status === PASSING ? row.run.id : null };
}

export async function latestResearchFlag(db: ReadDb, draftId: string) {
  const [flag] = await db.select().from(researchStalenessEvent).where(eq(researchStalenessEvent.draft_id, draftId))
    .orderBy(desc(researchStalenessEvent.id)).limit(1);
  return flag ?? null;
}

async function saveFlag(tx: Tx, actor: AppUser | null, draftId: string, before: Flag, after: Flag, auditBefore = before) {
  if (before.outdated === after.outdated && before.outdated_reasons.join() === after.outdated_reasons.join()
    && before.analyst_view_review_required === after.analyst_view_review_required
    && before.cleared_version_id === after.cleared_version_id && before.cleared_stop_id === after.cleared_stop_id) return false;
  await tx.insert(researchStalenessEvent).values({ draft_id: draftId, ...after });
  await audit(tx, actor, { event_type: "research_staleness", entity_name: "research_draft", entity_id: draftId,
    summary: actor ? "Analyst confirmed the analyst view" : "Research staleness flags changed",
    details: { before: auditBefore, after } });
  return true;
}

export async function clearAnalystViewReview(tx: Tx, actor: AppUser, draftId: string, reviewedRunId: string) {
  await tx.execute(researchWriteLock);
  await assertActiveAnalyst(tx, actor.id);
  const row = await approvedSnapshot(tx, draftId);
  if (!row || row.run?.status !== PASSING || row.run.id !== reviewedRunId)
    throw new Error("Review the current passing screening result before clearing");
  const before = row.flag ?? emptyFlag;
  if (!analystViewRequired(row.run, before)) return false;
  return saveFlag(tx, actor, draftId, before, { ...before, analyst_view_review_required: false,
    cleared_version_id: row.run.version_id, cleared_stop_id: row.run.stop_id },
    { ...before, analyst_view_review_required: true });
}

export async function updateStalenessForDraft(tx: Tx, draftId: string, now: Date) {
  await tx.execute(researchWriteLock);
  const row = await approvedSnapshot(tx, draftId);
  if (!row) return false;
  const [settings] = await tx.select({ price: researchSetting.price_move_threshold_percent, age: researchSetting.publication_age_days })
    .from(researchSetting).where(eq(researchSetting.id, 1));
  if (!settings) throw new Error("Research settings are unavailable");
  const filings = await latestResearchFilings(tx, row.security_id, now.toISOString().slice(0, 10));
  const runs = await tx.execute<Pick<ResearchPacket["screenings"][number], "methodology" | "status" | "immutable_hash">>(sql`
    select distinct on (m.slug) m.slug as methodology, r.status, r.immutable_hash
    from app.screening_run r join app.methodology_version v on v.id=r.methodology_version_id
    join app.methodology m on m.id=v.methodology_id
    where r.security_id=${row.security_id} and m.production_enabled and v.production_enabled
      and not r.is_demo and not m.is_demo and not v.is_demo and not m.production_blocked and not v.production_blocked
    order by m.slug, r.generated_at desc, (r.status <> ${PASSING}) desc, r.id desc
  `);
  const [price] = await tx.execute<{ period: string; value: string; currency: string }>(sql`
    select to_char(b.month_end_for, 'YYYY-MM') as period, b.close::text as value, b.currency
    from app.price_bar b join app.source s on s.id=b.source_id
    where b.security_id=${row.security_id} and not b.is_synthetic and not b.is_demo
      and not s.is_synthetic and not s.is_demo and not s.production_blocked and b.close > 0
      and b.month_end_for is not null and b.date <= ${now.toISOString().slice(0, 10)}::date
    order by to_char(b.month_end_for, 'YYYY-MM') desc, (b.price_provider='manual') desc, b.date desc, b.id desc limit 1
  `);
  const reasons = detectStaleness(row.packet, { filings, runs,
    close: price ? { ...price, value: Number(price.value) } : null },
    { price_move_threshold_percent: settings.price === null ? null : Number(settings.price), publication_age_days: settings.age },
    new Date(row.approved_at), now);
  const before = row.flag ?? emptyFlag;
  return saveFlag(tx, null, draftId, before, { ...before, outdated: reasons.length > 0, outdated_reasons: reasons,
    analyst_view_review_required: analystViewRequired(row.run ?? undefined, before) });
}

export type QueueRow = { id: string; ticker: string; reasons: StaleReason[]; review_required: boolean; refresh_in_progress: boolean };
export async function researchRefreshQueue(db: ReadDb = dbApp) {
  return db.execute<QueueRow>(sql`
    with latest as (
      select distinct on (d.security_id) d.id, d.security_id, s.ticker
      from app.research_draft d join app.security s on s.id=d.security_id
      ${approvalJoin}
      where d.state='approved'
      order by d.security_id, approval.occurred_at desc, d.id desc
    )
    select latest.id, latest.ticker, f.outdated_reasons as reasons,
      f.analyst_view_review_required as review_required,
      exists (select 1 from app.research_draft child
        join app.research_refresh rr on rr.draft_id=child.id
        where child.security_id=latest.security_id and child.state in
          ('requested','generated','in_review','changes_requested','edited')) as refresh_in_progress
    from latest join lateral (select f.* from app.research_staleness_event f
      where f.draft_id=latest.id order by f.id desc limit 1) f on f.outdated
    order by latest.ticker, latest.id
  `);
}

export async function latestApprovedResearchId(db: ReadDb, securityId: string) {
  const [row] = await db.execute<{ id: string }>(sql`
    select d.id from app.research_draft d ${approvalJoin}
    where d.security_id=${securityId} and d.state='approved'
    order by approval.occurred_at desc, d.id desc limit 1
  `);
  return row?.id;
}
