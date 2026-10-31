import { sql } from "drizzle-orm";
import { date, text, bigint, primaryKey, check } from "drizzle-orm/pg-core";
import { appSchema } from "./core";

// Deliberately no base(): no identity, timestamp, actor or per-event rows.
export const unmetSearch = appSchema.table("unmet_search", {
  normalized_query: text("normalized_query").notNull(),
  calendar_day: date("calendar_day", { mode: "string" }).notNull(),
  count: bigint("count", { mode: "number" }).notNull().default(1),
}, t => [
  primaryKey({ columns: [t.normalized_query, t.calendar_day] }),
  check("unmet_search_query_length", sql`length(${t.normalized_query}) BETWEEN 1 AND 40`),
  check("unmet_search_count_positive", sql`${t.count} > 0`),
]);
