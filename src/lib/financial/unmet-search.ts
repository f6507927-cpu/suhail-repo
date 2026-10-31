import "server-only";
import { sql } from "drizzle-orm";
import { requireRole } from "../auth/guards";
import { dbApp } from "../../db/app";

export async function getUnmetSearches() {
  await requireRole(["admin"]);
  return Array.from(await dbApp.execute<{ query: string; count: number }>(sql`
    select normalized_query as query, sum(count)::float8 as count
    from app.unmet_search
    group by normalized_query
    order by sum(count) desc, normalized_query collate "C" asc
    limit 20
  `));
}
