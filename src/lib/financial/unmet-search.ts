import "server-only";
import { sql } from "drizzle-orm";
import { requireRole } from "../auth/guards";
import { dbApp } from "../../db/app";

export async function getUnmetSearches() {
  await requireRole(["admin"]);
  return Array.from(await dbApp.execute<{ query: string; count: number; requests:number }>(sql`
    with top_queries as (
      select normalized_query,sum(count) as count from app.unmet_search
      group by normalized_query order by sum(count) desc, normalized_query collate "C" asc limit 20
    ), request_counts as (
      select r.normalized_query,count(distinct r.user_id)::float8 as requests
      from app.stock_request r join top_queries t using(normalized_query)
      group by r.normalized_query
    )
    select t.normalized_query as query,t.count::float8 as count,coalesce(r.requests,0)::float8 as requests
    from top_queries t left join request_counts r using(normalized_query)
    order by t.count desc,t.normalized_query collate "C" asc
  `));
}
