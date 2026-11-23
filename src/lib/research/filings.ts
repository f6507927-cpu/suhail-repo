import "server-only";
import { sql } from "drizzle-orm";
import type { Tx } from "../auth/audit";
import type { PacketInput } from "../../ai/research/contracts";

// Keep the newest period and newest reporting date independently: a late
// amendment to an older period can arrive after the newest period was filed.
export async function latestResearchFilings(db: Pick<Tx, "execute">, securityId: string, day: string) {
  const rows = await db.execute<{
    id: string; period_end: string; reported_date: string; source_id: string;
    label: string; url: string | null; accession: string | null;
    confidence_tier: NonNullable<PacketInput["filings"]>[number]["confidence_tier"];
  }>(sql`
    with eligible as (
      select p.id, p.period_end, p.reported_date, s.id as source_id, s.label,
        s.source_url as url, s.document_reference as accession, s.confidence_tier
      from app.security q join app.financial_period p on p.company_id = q.company_id
      join app.source s on s.id = p.source_id
      where q.id = ${securityId} and not p.is_demo and not s.is_demo
        and not s.is_synthetic and not s.production_blocked
        and p.period_end is not null and p.reported_date <= ${day}::date
    )
    (select * from eligible order by period_end desc, reported_date desc, id limit 1)
    union
    (select * from eligible order by reported_date desc, period_end desc, id limit 1)
  `);
  return rows.map(row => ({ id: row.id, period_end: row.period_end, reported_date: row.reported_date,
    date: row.reported_date, confidence_tier: row.confidence_tier,
    source: { id: row.source_id, label: row.label, url: row.url, accession: row.accession,
      is_synthetic: false, production_blocked: false } }));
}
