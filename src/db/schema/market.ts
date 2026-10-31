import { sql } from "drizzle-orm";
import {
  boolean,
  text,
  uuid,
  integer,
  date,
  unique,
  uniqueIndex,
  index,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import {
  appSchema,
  base,
  money,
  ratio,
  inputState,
  confidenceTier,
  activityCategory,
  time,
} from "./core";
import { mutableCreator, analystProfile } from "./accounts";

export const exchange = appSchema.table("exchange", {
  ...base(),
  created_by: mutableCreator(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  mic: text("mic"),
  country: text("country"),
  region: text("region"),
  timezone: text("timezone"),
  default_currency: text("default_currency"),
  regulator: text("regulator"),
  settlement_convention: text("settlement_convention"),
  is_active: boolean("is_active").notNull().default(true),
  notes: text("notes"),
});
export const company = appSchema.table("company", {
  ...base(),
  created_by: mutableCreator(),
  name: text("name").notNull(),
  cik: text("cik").unique(),
  name_ar: text("name_ar"),
  legal_name: text("legal_name"),
  country: text("country"),
  domicile: text("domicile"),
  description: text("description"),
  description_ar: text("description_ar"),
  description_en: text("description_en"),
  sector_label: text("sector_label"),
  industry_label: text("industry_label"),
  website: text("website"),
  founded_year: integer("founded_year"),
  fiscal_year_end: text("fiscal_year_end"),
  reporting_currency: text("reporting_currency"),
  sector_label_note: text("sector_label_note"),
  notes: text("notes"),
});
export const identifierType = appSchema.enum("identifier_type", [
  "isin",
  "cusip",
  "sedol",
  "ticker",
  "national_id",
]);
export const instrumentType = appSchema.enum("instrument_type", [
  "equity",
  "reit",
  "preferred",
  "fund",
  "sukuk",
  "other",
]);
export const listingStatus = appSchema.enum("listing_status", [
  "listed",
  "suspended",
  "delisted",
  "private",
]);
export const security = appSchema.table(
  "security",
  {
    ...base(),
    created_by: mutableCreator(),
    company_id: uuid("company_id").references(() => company.id),
    exchange_id: uuid("exchange_id").references(() => exchange.id),
    exchange_code: text("exchange_code"),
    ticker: text("ticker").notNull(),
    display_symbol: text("display_symbol"),
    identifier_type: identifierType("identifier_type")
      .notNull()
      .default("ticker"),
    identifier_value: text("identifier_value"),
    currency: text("currency"),
    instrument_type: instrumentType("instrument_type")
      .notNull()
      .default("equity"),
    listing_status: listingStatus("listing_status").notNull().default("listed"),
    slug: text("slug").notNull().unique(),
    in_universe: boolean("in_universe").notNull().default(false),
    last_ingest_at: time("last_ingest_at"),
    last_ingest_error: text("last_ingest_error"),
    coverage_analyst_id: uuid("coverage_analyst_id").references(
      () => analystProfile.id,
      { onDelete: "set null" },
    ),
    coverage_started_at: time("coverage_started_at"),
    demo_label: text("demo_label"),
    notes: text("notes"),
  },
  (t) => [
    unique("security_exchange_ticker_unique").on(t.exchange_id, t.ticker),
    index("security_public_company_idx")
      .on(t.company_id)
      .where(sql`${t.in_universe} AND ${t.listing_status} = 'listed'`),
  ],
);
export const sourceType = appSchema.enum("source_type", [
  "annual_report",
  "interim_report",
  "regulatory_filing",
  "investor_relations",
  "market_data",
  "data_provider",
  "methodology_document",
  "company_website",
  "news",
  "internal",
]);
export const source = appSchema.table("source", {
  ...base(),
  // D-93: synthetic/demo provenance cannot later be relabelled production evidence.
  production_blocked: boolean("production_blocked").notNull().default(false),
  created_by: mutableCreator(),
  label: text("label").notNull(),
  source_type: sourceType("source_type").notNull(),
  provider: text("provider"),
  document_title: text("document_title"),
  document_reference: text("document_reference"),
  source_url: text("source_url"),
  retrieved_at: time("retrieved_at"),
  reporting_period: text("reporting_period"),
  confidence_tier: confidenceTier("confidence_tier")
    .notNull()
    .default("Verified"),
  is_synthetic: boolean("is_synthetic").notNull().default(true),
  notes: text("notes"),
});
export const periodType = appSchema.enum("period_type", [
  "annual",
  "semiannual",
  "quarterly",
]);
export const financialPeriod = appSchema.table(
  "financial_period",
  {
    ...base(),
    created_by: mutableCreator(),
    company_id: uuid("company_id")
      .notNull()
      .references(() => company.id),
    period_type: periodType("period_type").notNull().default("annual"),
    fiscal_year: integer("fiscal_year"),
    fiscal_period_label: text("fiscal_period_label").notNull(),
    period_start: date("period_start"),
    period_end: date("period_end"),
    reported_date: date("reported_date"),
    currency: text("currency"),
    is_latest: boolean("is_latest").notNull().default(false),
    filing_reference: text("filing_reference"),
    source_id: uuid("source_id").references(() => source.id),
    notes: text("notes"),
  },
  (t) => [
    unique("financial_period_identity_unique").on(
      t.company_id,
      t.period_type,
      t.fiscal_year,
      t.fiscal_period_label,
    ),
    uniqueIndex("financial_period_latest_unique")
      .on(t.company_id, t.period_type)
      .where(sql`${t.is_latest}`),
    index("financial_period_source_idx").on(t.source_id),
  ],
);
export const financialFact = appSchema.table(
  "financial_fact",
  {
    ...base(),
    created_by: mutableCreator(),
    company_id: uuid("company_id")
      .notNull()
      .references(() => company.id),
    period_id: uuid("period_id")
      .notNull()
      .references(() => financialPeriod.id),
    // D-122: derived market evidence is security-specific, unlike SEC facts.
    security_id: uuid("security_id").references(() => security.id),
    line_item: text("line_item").notNull(),
    label: text("label"),
    value: money("value"),
    value_text: text("value_text"),
    currency: text("currency"),
    unit_scale: text("unit_scale").notNull().default("absolute"),
    input_state: inputState("input_state").notNull().default("reported"),
    confidence_tier: confidenceTier("confidence_tier")
      .notNull()
      .default("Verified"),
    source_id: uuid("source_id").references(() => source.id),
    as_of_date: date("as_of_date"),
    mapping_note: text("mapping_note"),
    shares_class_concern: boolean("shares_class_concern").notNull().default(false),
    unknown_note: text("unknown_note"),
    origin: text("origin").notNull().default("legacy"),
    protected_current: boolean("protected_current").notNull().default(false),
    calculation_version: text("calculation_version"),
    evidence_key: text("evidence_key").unique(),
    sec_baseline_id: uuid("sec_baseline_id"),
    is_current: boolean("is_current").notNull().default(true),
  },
  (t) => [
    foreignKey({ columns: [t.sec_baseline_id], foreignColumns: [t.id] }),
    uniqueIndex("financial_fact_current_unique")
      .on(t.company_id, t.period_id, t.line_item)
      .where(sql`${t.is_current} AND ${t.security_id} IS NULL`),
    uniqueIndex("financial_fact_security_current_unique")
      .on(t.company_id, t.period_id, t.line_item, t.security_id)
      .where(sql`${t.is_current} AND ${t.security_id} IS NOT NULL`),
    index("financial_fact_source_idx").on(t.source_id),
  ],
);
export const businessSegment = appSchema.table(
  "business_segment",
  {
    ...base(),
    created_by: mutableCreator(),
    company_id: uuid("company_id")
      .notNull()
      .references(() => company.id),
    period_id: uuid("period_id").references(() => financialPeriod.id),
    segment_name: text("segment_name").notNull(),
    description: text("description"),
    activity_category: activityCategory("activity_category")
      .notNull()
      .default("unclassified"),
    category_basis: text("category_basis"),
    revenue_amount: money("revenue_amount"),
    revenue_share: ratio("revenue_share"),
    input_state: inputState("input_state").notNull().default("reported"),
    confidence_tier: confidenceTier("confidence_tier")
      .notNull()
      .default("Verified"),
    source_id: uuid("source_id").references(() => source.id),
  },
  (t) => [
    index("business_segment_source_idx").on(t.source_id),
    check("business_segment_share_fraction", sql`${t.revenue_share} >= 0 AND ${t.revenue_share} <= 1`),
  ],
);
export const priceBar = appSchema.table("price_bar", {
  ...base(),
  created_by: mutableCreator(),
  security_id: uuid("security_id")
    .notNull()
    .references(() => security.id),
  ticker: text("ticker"),
  date: date("date").notNull(),
  // Explicit sourced assertion; no calendar or arbitrary earlier-price inference.
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
