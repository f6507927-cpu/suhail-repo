import "server-only";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import { company, security, exchange, source, financialFact, businessSegment, priceBar } from "../../db/schema/market";
import { analystProfile } from "../../db/schema/accounts";
import { activityCategory, confidenceTier, inputState } from "../../db/schema/core";
import { audit, type Tx } from "../auth/audit";
import { decimal, factKey, insertCurrent, latestSec, requireFinancial, securityContext, type Actor } from "./persistence";
import type { FinancialCommand, SecurityLookup } from "./contracts";
import { SEC_CALCULATION_VERSION } from "../../ingest/sec/mapping";
import { refreshMarketValue, refreshCompanyMarketValues } from "./market-value-persistence";
import { comparePriceCorrections, selectMonthEnd } from "./market-value";

export const idSchema = z.string().uuid();
const amount = z.string().regex(/^-?\d{1,24}(?:\.\d{1,6})?$/, "Use a decimal amount with at most six decimal places");
const url = z.string().url().refine(v => /^https?:\/\//.test(v), "Use an HTTP or HTTPS source URL");
const evidence = z.object({
  label: z.string().trim().min(1).max(500),
  source_type: z.enum(["internal", "regulatory_filing"]),
  source_url: url.optional().or(z.literal("")),
  document_reference: z.string().trim().max(2000).optional(),
}).refine(s => s.source_type === "internal" || !!(s.source_url && s.document_reference),
  "A filing source needs its URL and note reference");
const rank = ["Verified", "Calculated", "Estimated", "AI Interpretation"] as const;
const weakest = (...values: (typeof rank[number])[]) => rank[Math.max(...values.map(v => rank.indexOf(v)))];
export function securitySlug(exchangeCode: string, ticker: string) {
  return `${exchangeCode}-${ticker}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export async function addSecurity(tx: Tx, actor: Actor, lookup: SecurityLookup) {
  let [c] = await tx.select().from(company).where(eq(company.cik, lookup.cik));
  if (!c) [c] = await tx.insert(company).values({
    cik: lookup.cik, name: lookup.name, legal_name: lookup.name, sector_label: lookup.sector,
    sector_label_note: "SEC SIC description — a label, never screening evidence",
    fiscal_year_end: lookup.fiscalYearEnd, reporting_currency: "USD", created_by: actor?.id,
  }).returning();
  let [e] = await tx.select().from(exchange).where(eq(exchange.code, lookup.exchange));
  if (!e) [e] = await tx.insert(exchange).values({ code: lookup.exchange, name: lookup.exchange,
    country: "US", default_currency: "USD", created_by: actor?.id }).returning();
  const [existing] = await tx.select().from(security).where(and(
    eq(security.exchange_id, e.id), eq(security.ticker, lookup.ticker)));
  if (existing) {
    requireFinancial(existing.company_id === c.id, "Ticker belongs to another issuer");
    if (existing.in_universe) return existing.id;
    await tx.update(security).set({ in_universe: true }).where(eq(security.id, existing.id));
  }
  const [s] = existing ? [existing] : await tx.insert(security).values({
    company_id: c.id, exchange_id: e.id, exchange_code: lookup.exchange, ticker: lookup.ticker,
    display_symbol: lookup.ticker, slug: securitySlug(lookup.exchange, lookup.ticker),
    in_universe: true, listing_status: "listed", currency: "USD", created_by: actor?.id,
  }).returning();
  await audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: s.id,
    summary: "Security added to curated universe", details: { cik: lookup.cik } });
  return s.id;
}
async function analystSource(tx: Tx, actor: Actor, value: z.infer<typeof evidence>, tier: typeof rank[number]) {
  const [s] = await tx.insert(source).values({ ...value, source_url: value.source_url || null,
    provider: "Analyst entry", confidence_tier: tier, is_synthetic: false, created_by: actor?.id }).returning();
  return s.id;
}
/** All callers already crossed the canonical admin guard, or the trusted job boundary. */
export async function mutateFinancial(tx: Tx, actor: Actor, command: FinancialCommand) {
  const { s, c, period } = await securityContext(tx, idSchema.parse(command.securityId));
  const data = command.data ?? {};
  const note = async (summary: string, details: Record<string, string | number | boolean | null> = {}) =>
    audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: s.id, summary, details });
  if (command.operation === "remove") {
    z.object({ confirm: z.literal(true) }).parse(data);
    await tx.update(security).set({ in_universe: false }).where(eq(security.id, s.id));
    await note("Security removed from curated universe"); return s.id;
  }
  if (command.operation === "company") {
    const values = z.object({ name_ar: z.string().max(1000), description_ar: z.string().max(20000),
      description_en: z.string().max(20000) }).parse(data);
    await tx.update(company).set(values).where(eq(company.id, c.id));
    await note("Company descriptions updated"); return c.id;
  }
  if (command.operation === "coverage") {
    const { analystId } = z.object({ analystId: idSchema.nullable() }).parse(data);
    if (analystId) {
      const [a] = await tx.select().from(analystProfile).where(eq(analystProfile.id, analystId));
      requireFinancial(a, "Choose an existing analyst");
    }
    await tx.update(security).set({ coverage_analyst_id: analystId,
      coverage_started_at: analystId ? new Date() : null }).where(eq(security.id, s.id));
    await note("Analyst coverage updated", { analystId }); return s.id;
  }
  requireFinancial(period, "Ingest an annual period first");
  if (command.operation === "addProhibitedIncome") {
    const v = z.object({ periodId: idSchema, period_start: z.string().date(), period_end: z.string().date(),
      value: amount.refine(v => Number(v) >= 0), input_state: z.enum(["reported", "estimated"]),
      confidence_tier: z.enum(["Verified", "Estimated"]), reason: z.string().trim().min(1).max(4000),
      source: evidence }).parse(data);
    requireFinancial(v.periodId === period.id && v.period_start === period.period_start && v.period_end === period.period_end,
      "Prohibited income evidence must match the current annual revenue period");
    requireFinancial((v.input_state === "reported" && v.confidence_tier === "Verified") ||
      (v.input_state === "estimated" && v.confidence_tier === "Estimated"), "Use reported/Verified or estimated/Estimated");
    const [current] = await tx.select().from(financialFact).where(and(
      factKey(c.id, period.id, "prohibited_income"), eq(financialFact.is_current, true)));
    requireFinancial(!current, "Prohibited income already exists; use the sourced override");
    const sourceId = await analystSource(tx, actor, v.source, v.confidence_tier);
    const next = await insertCurrent(tx, { company_id: c.id, period_id: period.id, line_item: "prohibited_income",
      value: decimal(v.value), currency: "USD", as_of_date: period.period_end, source_id: sourceId,
      input_state: v.input_state, confidence_tier: v.confidence_tier, origin: "override", protected_current: true,
      calculation_version: SEC_CALCULATION_VERSION, created_by: actor?.id, mapping_note: v.reason });
    await note("Prohibited income added from sourced annual evidence", { factId: next.id });
    return next.id;
  }
  if (command.operation === "override" || command.operation === "confirm") {
    const values = z.object({ factId: idSchema, reason: z.string().trim().min(1).max(4000),
      source: evidence, value: amount.nullable().optional(), input_state: z.enum(inputState.enumValues).optional(),
      confidence_tier: z.enum(confidenceTier.enumValues).optional() }).parse(data);
    const [before] = await tx.select().from(financialFact).where(and(
      eq(financialFact.id, values.factId), eq(financialFact.company_id, c.id),
      eq(financialFact.period_id, period.id), eq(financialFact.is_current, true)));
    requireFinancial(before, "Current fact not found; reload the record");
    requireFinancial(before.line_item !== "market_value_basis", "Market value basis is derived, not directly overridable");
    const confirming = command.operation === "confirm";
    requireFinancial(!confirming || (before.line_item === "interest_bearing_investments" &&
      before.input_state === "estimated" && before.value !== null && values.source.source_type === "regulatory_filing"),
    "Filing confirmation requires estimated investments and a filing-note source");
    const state = confirming ? "reported" : values.input_state;
    const tier = confirming ? "Verified" : values.confidence_tier;
    requireFinancial(state && tier && (confirming || values.value !== undefined), "Supply value, state and tier");
    requireFinancial(confirming || (values.value === null ? state === "unknown" : state !== "unknown" && state !== "missing"),
      "Unknown facts must have a null value");
    if (before.line_item === "prohibited_income") {
      requireFinancial(data.period_start === period.period_start && data.period_end === period.period_end,
        "Prohibited income evidence must match the current annual revenue period");
      requireFinancial(values.value === null ? state === "unknown" :
        Number(values.value) >= 0 && ((state === "reported" && tier === "Verified") || (state === "estimated" && tier === "Estimated")),
      "Use nonnegative reported/Verified or estimated/Estimated prohibited income");
    }
    const [oldSource] = before.source_id ? await tx.select().from(source).where(eq(source.id, before.source_id)) : [];
    if (!confirming && before.protected_current && before.value === (values.value === null ? null : Number(values.value)) &&
      before.input_state === state && before.confidence_tier === tier && before.mapping_note === values.reason &&
      oldSource?.label === values.source.label && oldSource.source_type === values.source.source_type &&
      (oldSource.source_url ?? "") === (values.source.source_url ?? "") &&
      (oldSource.document_reference ?? "") === (values.source.document_reference ?? "")) return before.id;
    const baseline = before.sec_baseline_id ?? (await latestSec(tx, c.id, period.id, before.line_item))?.id ?? null;
    const sourceId = await analystSource(tx, actor, values.source, tier);
    const next = await insertCurrent(tx, { company_id: c.id, period_id: period.id, line_item: before.line_item,
      value: confirming ? before.value : values.value === null ? null : decimal(values.value!),
      currency: before.currency, as_of_date: before.as_of_date, source_id: sourceId,
      input_state: state, confidence_tier: tier, protected_current: true,
      origin: confirming ? "filing_confirmation" : "override", sec_baseline_id: baseline,
      shares_class_concern: before.shares_class_concern,
      calculation_version: before.calculation_version, created_by: actor?.id,
      mapping_note: values.reason, unknown_note: state === "unknown" ? values.reason : null });
    await note(confirming ? "Investments confirmed from filing" : "Financial fact overridden",
      { before: before.id, after: next.id, reason: values.reason });
    if (["shares_outstanding", "total_equity"].includes(before.line_item))
      await refreshCompanyMarketValues(tx, actor, c.id, new Date().toISOString().slice(0, 10));
    return next.id;
  }
  if (command.operation === "accept") {
    const { factId } = z.object({ factId: idSchema }).parse(data);
    const [incoming] = await tx.select().from(financialFact).where(and(
      eq(financialFact.id, factId), eq(financialFact.company_id, c.id),
      eq(financialFact.period_id, period.id), eq(financialFact.origin, "sec"), eq(financialFact.is_current, false)));
    requireFinancial(incoming, "Stored SEC alternative not found");
    const [before] = await tx.select().from(financialFact).where(and(
      factKey(c.id, period.id, incoming.line_item), eq(financialFact.is_current, true)));
    requireFinancial(before?.protected_current, "Only a protected current correction can be replaced");
    await tx.update(financialFact).set({ is_current: false }).where(eq(financialFact.id, before.id));
    await tx.update(financialFact).set({ is_current: true }).where(eq(financialFact.id, incoming.id));
    await note("SEC value accepted; correction protection released", { before: before.id, after: incoming.id });
    if (["shares_outstanding", "total_equity"].includes(incoming.line_item))
      await refreshCompanyMarketValues(tx, actor, c.id, new Date().toISOString().slice(0, 10));
    return incoming.id;
  }
  if (command.operation === "segment" || command.operation === "deleteSegment") {
    const segmentId = data.id ? idSchema.parse(data.id) : null;
    if (segmentId) {
      const [existing] = await tx.select().from(businessSegment).where(and(
        eq(businessSegment.id, segmentId), eq(businessSegment.company_id, c.id), eq(businessSegment.period_id, period.id)));
      requireFinancial(existing, "Latest-period segment not found");
    }
    if (command.operation === "deleteSegment") {
      requireFinancial(segmentId, "Segment identity is required");
      await tx.delete(businessSegment).where(eq(businessSegment.id, segmentId));
      await note("Business segment deleted", { segmentId }); return segmentId;
    }
    const v = z.object({ segment_name: z.string().trim().min(1).max(1000),
      description: z.string().max(20000).optional(), revenue_amount: amount.nullable(),
      activity_category: z.enum(activityCategory.enumValues).default("unclassified"),
      category_basis: z.string().max(4000).optional(), input_state: z.enum(inputState.enumValues),
      confidence_tier: z.enum(confidenceTier.enumValues), source: evidence }).parse(data);
    requireFinancial(v.activity_category === "unclassified" || v.category_basis?.trim(), "A classified segment needs its category basis");
    requireFinancial(v.revenue_amount === null ? v.input_state === "unknown" : v.input_state !== "unknown" && v.input_state !== "missing",
      "Unknown segment revenue must have a null amount");
    const [revenue] = await tx.select().from(financialFact).where(and(
      factKey(c.id, period.id, "total_revenue"), eq(financialFact.is_current, true)));
    const canDerive = v.revenue_amount !== null && revenue?.value !== null && revenue?.value !== undefined &&
      revenue.value > 0 && !["unknown", "missing"].includes(revenue.input_state);
    const sourceId = await analystSource(tx, actor, v.source, v.confidence_tier);
    const { source: _evidence, ...fields } = v; void _evidence;
    const values = { ...fields, company_id: c.id, period_id: period.id, source_id: sourceId,
      revenue_amount: v.revenue_amount === null ? null : decimal(v.revenue_amount),
      revenue_share: canDerive ? sql<number>`${v.revenue_amount}::numeric / (select value from app.financial_fact where id = ${revenue.id})` : null,
      input_state: canDerive ? "derived" as const : v.input_state,
      confidence_tier: canDerive ? weakest("Calculated", v.confidence_tier, revenue.confidence_tier) : v.confidence_tier };
    const [row] = segmentId
      ? await tx.update(businessSegment).set(values).where(eq(businessSegment.id, segmentId)).returning()
      : await tx.insert(businessSegment).values({ ...values, created_by: actor?.id }).returning();
    await note("Business segment saved", { segmentId: row.id }); return row.id;
  }
  if (command.operation === "price") {
    const v = z.object({ date: z.string().date(), month_end_for: z.string().date().optional(),
      close: amount.refine(v => Number(v) > 0, "Close must be positive"),
      currency: z.literal("USD"), source_label: z.string().trim().min(1).max(500), source_url: url }).parse(data);
    requireFinancial(!v.month_end_for || (v.month_end_for.slice(0, 7) === v.date.slice(0, 7) &&
      v.date <= v.month_end_for && new Date(`${v.month_end_for}T00:00:00Z`).getUTCDate() ===
      new Date(Date.UTC(Number(v.month_end_for.slice(0, 4)), Number(v.month_end_for.slice(5, 7)), 0)).getUTCDate()),
    "Month-end evidence must identify the last trading-day close in the same calendar month");
    const relevant = await tx.select().from(priceBar).where(and(eq(priceBar.security_id, s.id),
      v.month_end_for ? or(eq(priceBar.date, v.date), eq(priceBar.month_end_for, v.month_end_for)) : eq(priceBar.date, v.date)));
    const latest = relevant.filter(p => p.date === v.date).sort(comparePriceCorrections)[0];
    const monthLatest = v.month_end_for ? selectMonthEnd(relevant, v.month_end_for) : latest;
    // An old matching row is not a duplicate if later evidence superseded it.
    // Check both daily and attested-month observations, including date corrections.
    if (latest?.source_id && monthLatest?.id === latest.id &&
      Number(latest.close) === Number(v.close) && latest.currency === v.currency &&
      latest.source_label === v.source_label && latest.source_url === v.source_url &&
      (latest.month_end_for ?? undefined) === v.month_end_for) return latest.id;
    const [shares] = await tx.select().from(financialFact).where(and(
      factKey(c.id, period.id, "shares_outstanding"), eq(financialFact.is_current, true)));
    const [currentCap] = await tx.select().from(financialFact).where(and(
      factKey(c.id, period.id, "market_cap"), eq(financialFact.is_current, true)));
    requireFinancial(!currentCap?.protected_current, "A protected market-cap correction must be explicitly replaced first");
    requireFinancial(s.currency === v.currency, "Price currency does not match the security");
    const [priceSource] = await tx.insert(source).values({ label: v.source_label, source_type: "market_data",
      provider: "Manual entry", source_url: v.source_url, reporting_period: v.date,
      confidence_tier: "Verified", is_synthetic: false, created_by: actor?.id }).returning();
    // The issuer lock serializes corrections. Keep their order visible at the
    // millisecond precision returned by the database driver, including rapid writes.
    const latestTime = relevant.reduce((time, p) => Math.max(time, +new Date(p.created_at)), 0);
    const createdAt = latestTime ? sql`greatest(clock_timestamp(), ${new Date(latestTime + 1).toISOString()}::timestamptz)` : sql`clock_timestamp()`;
    const [p] = await tx.insert(priceBar).values({ ...v, close: decimal(v.close), source_id: priceSource.id, created_at: createdAt,
      security_id: s.id, ticker: s.ticker, is_synthetic: false, created_by: actor?.id }).returning();
    const usable = shares?.value !== null && shares?.value !== undefined && shares.value >= 0 &&
      !["unknown", "missing"].includes(shares.input_state);
    const cap = await insertCurrent(tx, { company_id: c.id, period_id: period.id, line_item: "market_cap",
      value: usable ? sql<number>`(select value from app.financial_fact where id = ${shares.id}) * ${v.close}::numeric` : null,
      currency: v.currency, as_of_date: v.date, source_id: priceSource.id, origin: "manual_price",
      input_state: usable ? "derived" : "unknown", confidence_tier: usable ? weakest("Calculated", shares.confidence_tier) : "Estimated",
      unknown_note: usable ? null : "No usable shares outstanding for market capitalization",
      mapping_note: `shares fact ${shares?.id ?? "unavailable"} (as of ${shares?.as_of_date ?? "unknown"}) × manual close ${p.id} (${v.date}); price source ${priceSource.id}; shares source ${shares?.source_id ?? "unavailable"}`,
      calculation_version: SEC_CALCULATION_VERSION, created_by: actor?.id });
    await refreshMarketValue(tx, actor, c.id, s.id, new Date().toISOString().slice(0, 10));
    await note("Manual close and market-cap evidence saved", { priceId: p.id, factId: cap.id }); return p.id;
  }
  requireFinancial(false, "Unknown financial operation");
}
