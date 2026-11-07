import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { dbPublic } from "./public";
import type { StatusCode } from "../components/foundation/StatusBadge";
import { demoVisibleSql } from "./public-visibility";
import { normalizeSearch } from "../lib/search-normalization";

export type SearchResult = {
  slug: string; ticker: string; name: string; name_ar: string | null; display_name_en: string | null;
  exchange: string | null; status: StatusCode | null;
};
export function searchQuery(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const query = input.trim();
  return query.length >= 1 && query.length <= 40 ? query : null;
}
const literalPattern = (query: string) => query.replace(/[\\%_]/g, "\\$&");

export type ScreenedTicker = Pick<SearchResult, "slug" | "ticker">;
export type SearchCoverage = { count: number; screened: ScreenedTicker[] };

/** UX-4 / D-15/D-16: one aggregate row, never a downloaded universe/list. */
export async function countPublicListedSecurities(db: Pick<typeof dbPublic, "execute"> = dbPublic): Promise<number> {
  const rows = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from app.security s join app.company c on c.id = s.company_id
    where s.in_universe = true and s.listing_status = 'listed'
      and (${demoVisibleSql()} = true or (s.is_demo = false and c.is_demo = false))
  `);
  const count = rows[0]?.count;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid public coverage count");
  return count;
}

/** Same visible/default-version run boundary as search; bounded to five. */
export async function getPublicScreenedTickers(db: Pick<typeof dbPublic, "execute"> = dbPublic): Promise<ScreenedTicker[]> {
  const rows = await db.execute<ScreenedTicker>(sql`
    select s.slug, s.ticker
    from app.security s join app.company c on c.id = s.company_id
    where s.in_universe = true and s.listing_status = 'listed'
      and (${demoVisibleSql()} = true or (s.is_demo = false and c.is_demo = false))
      and exists (
        select 1 from app.screening_run r
        join app.methodology_version v on v.id = r.methodology_version_id and v.is_public = true
        join app.methodology m on m.id = v.methodology_id
          and (${demoVisibleSql()} = true or (r.is_demo = false and v.is_demo = false and v.production_blocked = false
            and m.is_demo = false and m.production_blocked = false and m.official_or_inspired <> 'internal_example'))
        where r.security_id = s.id
          and v.id = (select default_shariah_methodology_version_id from app.public_settings limit 1)
      )
    order by s.ticker, s.id
    limit 5
  `);
  return Array.from(rows);
}
// Symmetric SQL normalization preserves display names and ticker semantics.
// U+0610–061A, U+064B–065F, U+0670, U+06D6–06ED: Arabic marks.
function normalized(value: SQL): SQL {
  return sql`regexp_replace(translate(${value}, 'أإآةىـ', 'اااهي'), '[ؐ-ًؚ-ٰٟۖ-ۭ]', '', 'g')`;
}

export async function searchPublicStocks(input: unknown, db: Pick<typeof dbPublic, "execute"> = dbPublic): Promise<SearchResult[]> {
  const query = searchQuery(input);
  // No empty/list-all path, and no lazy DB client access for invalid input.
  if (!query) return [];
  const pattern = literalPattern(query);
  const nameQuery = normalized(sql`${pattern}::text`);
  const nonempty = normalized(sql`${query}::text`);
  // D-16/D-36/D-120: explicit public projection and visible editorial default.
  // Bound candidates BEFORE status lookup; no evidence/history is loaded.
  const rows = await db.execute<SearchResult>(sql`
    with candidates as (
      select s.id, s.slug, s.ticker, c.name, c.name_ar, c.display_name_en,
        coalesce(e.code, s.exchange_code) as exchange
      from app.security s
      join app.company c on c.id = s.company_id
      left join app.exchange e on e.id = s.exchange_id
      where s.in_universe = true and s.listing_status = 'listed'
        and (${demoVisibleSql()} = true or (s.is_demo = false and c.is_demo = false))
        and (
          s.ticker ilike ${pattern + "%"} escape '\\'
          or (${nonempty} <> '' and (
            ${normalized(sql`c.name`)} ilike ('%' || ${nameQuery} || '%') escape '\\'
            or ${normalized(sql`c.display_name_en`)} ilike ('%' || ${nameQuery} || '%') escape '\\'
            or ${normalized(sql`c.name_ar`)} ilike ('%' || ${nameQuery} || '%') escape '\\'
          ))
        )
      order by s.ticker, s.id
      limit 10
    )
    select c.slug, c.ticker, c.name, c.name_ar, c.display_name_en, c.exchange, latest.status
    from candidates c
    left join lateral (
      select r.status
      from app.screening_run r
      join app.methodology_version v on v.id = r.methodology_version_id and v.is_public = true
      join app.methodology m on m.id = v.methodology_id
        and (${demoVisibleSql()} = true or (r.is_demo = false and v.is_demo = false and v.production_blocked = false
          and m.is_demo = false and m.production_blocked = false and m.official_or_inspired <> 'internal_example'))
      where r.security_id = c.id
        and v.id = (select default_shariah_methodology_version_id from app.public_settings limit 1)
      order by r.generated_at desc, r.created_at desc, r.id desc
      limit 1
    ) latest on true
    order by c.ticker, c.id
  `);
  const results = Array.from(rows);
  if (!results.length && normalizeSearch(query)) {
    try { await db.execute(sql`select app.record_unmet_search(${query}::text)`); }
    catch { /* Best effort: never log query/request identity or break empty state. */ }
  }
  return results;
}
