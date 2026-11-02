import "server-only";
import { boolean, date, integer, text, uuid } from "drizzle-orm/pg-core";
import { appSchema, base, money } from "./schema/core";
import { mutableCreator } from "./schema/accounts";
import { priceBar, security, source } from "./schema/market";
import { apiNinjasStorageReady } from "../ingest/prices/storage-ready";

// D-153: the migration remains unapplied. Keep the pre-0013 table shape for
// existing reads, INSERT column lists and RETURNING clauses until authorized
// storage rollout. This runtime compatibility table is NOT a migration schema.
const legacyPriceBar = appSchema.table("price_bar", {
  ...base(),
  created_by: mutableCreator(),
  security_id: uuid("security_id").notNull().references(() => security.id),
  ticker: text("ticker"),
  date: date("date").notNull(),
  month_end_for: date("month_end_for"),
  close: money("close"),
  currency: text("currency"),
  week_index: integer("week_index").notNull().default(0),
  advance_batch: text("advance_batch"),
  is_synthetic: boolean("is_synthetic").notNull().default(true),
  source_label: text("source_label"),
  source_url: text("source_url"),
  source_id: uuid("source_id").references(() => source.id),
});

export const runtimePriceBar = apiNinjasStorageReady() ? priceBar : legacyPriceBar;
