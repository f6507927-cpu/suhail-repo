import { sql } from "drizzle-orm";
import { dbPublic } from "../../../../db/public";
import type { PublicStockResearch } from "../../../../stock/research-public-types";
import { PUBLIC_RESEARCH_COPY_APPROVED } from "../../../../lib/research/publication-policy";

// The page shell uses ISR. Never put gate-dependent data in that cache.
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (!PUBLIC_RESEARCH_COPY_APPROVED) return new Response(null, { status: 404, headers });
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9.-]{0,119}$/.test(slug)) return new Response(null, { status: 404, headers });
  const [data] = await dbPublic.execute<PublicStockResearch>(sql`
    select plain_summary,analyst_view,name_ar,name_en,title_ar,title_en,credentials,headshot_object_key,bio_ar,bio_en,
      (approval_at at time zone 'UTC')::date::text as approval_at,data_as_of::text,methodologies,citations,update_codes,
      (updated_at at time zone 'UTC')::date::text as updated_at,outdated_codes,
      (outdated_at at time zone 'UTC')::date::text as outdated_at
    from app.public_stock_research where slug=${slug}
  `);
  return data ? Response.json(data, { headers }) : new Response(null, { status: 404, headers });
}
