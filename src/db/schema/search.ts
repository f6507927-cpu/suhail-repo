import { sql } from "drizzle-orm";
import { date, text, bigint, primaryKey, check, uuid, index } from "drizzle-orm/pg-core";
import { appSchema, time } from "./core";
import { users } from "./accounts";

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
// D-152/D-50: distinct from identity-free unmet_search; owned, deletable data.
export const stockRequest=appSchema.table("stock_request",{
  user_id:uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  normalized_query:text("normalized_query").notNull(),
  created_at:time("created_at").notNull().defaultNow(),
},t=>[
  primaryKey({columns:[t.user_id,t.normalized_query]}),
  check("stock_request_query_length",sql`length(${t.normalized_query}) BETWEEN 1 AND 40`),
  index("stock_request_query_idx").on(t.normalized_query),
]);
