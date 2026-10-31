import "server-only";
import { and, eq, desc } from "drizzle-orm";
import type { Tx } from "../auth/audit";
import { financialFact, businessSegment, source, priceBar } from "../../db/schema/market";
import { mutateFinancial } from "../financial/service";
import { securityContext, factKey, requireFinancial, type Actor } from "../financial/persistence";
import { deriveMarketValue, selectMonthEnd } from "../financial/market-value";
import { manualPriceProvider, manualCloseCommand } from "../../ingest/prices/manual";
import { CLOSE_FIELDS, MONTH_ENDS, type LaunchRow } from "./contracts";

export async function applyLaunchEvidence(tx: Tx, actor: Actor, securityId: string, row: LaunchRow) {
  const { c, period } = await securityContext(tx, securityId);
  requireFinancial(period?.period_start && period.period_end, "Current annual period unavailable");
  for (const [i, field] of CLOSE_FIELDS.entries())
    await mutateFinancial(tx, actor, manualCloseCommand(securityId, {
      // These three founder-attested dates are weekdays; no weekend date is guessed.
      date: MONTH_ENDS[i], month_end_for: MONTH_ENDS[i], close: row[field],
      currency: "USD", source_label: row.price_source_label, source_url: row.price_source_url,
    }));
  const [revenue] = await tx.select().from(financialFact).where(and(
    factKey(c.id, period.id, "total_revenue"), eq(financialFact.is_current, true)));
  requireFinancial(revenue?.value !== null && revenue?.value !== undefined && revenue.value > 0 &&
    revenue.source_id && !["unknown", "missing"].includes(revenue.input_state), "Sourced current annual total_revenue unavailable or nonpositive");
  const [revenueSource] = await tx.select().from(source).where(eq(source.id, revenue.source_id));
  requireFinancial(revenueSource?.source_url && revenueSource.document_reference, "Annual revenue filing provenance unavailable");
  const segments = await tx.select().from(businessSegment).where(and(eq(businessSegment.company_id, c.id), eq(businessSegment.period_id, period.id)));
  requireFinancial(!segments.length || (segments.length === 1 && segments[0].segment_name === "Whole company"), "Existing segment structure conflicts; no deletion or guessed reclassification");
  const segment = segments[0];
  const [oldSource] = segment?.source_id ? await tx.select().from(source).where(eq(source.id, segment.source_id)) : [];
  if (!segment || segment.revenue_amount !== revenue.value || segment.revenue_share !== 1 ||
    segment.activity_category !== row.activity_category || segment.category_basis !== row.category_basis ||
    segment.input_state !== "derived" ||
    segment.confidence_tier !== (["Estimated", "AI Interpretation"].includes(revenue.confidence_tier) ? revenue.confidence_tier : "Calculated") ||
    oldSource?.confidence_tier !== revenue.confidence_tier || oldSource?.label !== revenueSource.label ||
    oldSource?.source_url !== revenueSource.source_url || oldSource?.document_reference !== revenueSource.document_reference) {
    await mutateFinancial(tx, actor, { operation: "segment", securityId, data: {
      ...(segment ? { id: segment.id } : {}), segment_name: "Whole company", revenue_amount: String(revenue.value),
      activity_category: row.activity_category, category_basis: row.category_basis,
      input_state: "reported", confidence_tier: revenue.confidence_tier,
      source: { label: revenueSource.label, source_type: "regulatory_filing", source_url: revenueSource.source_url,
        document_reference: revenueSource.document_reference },
    } });
  }
  if (row.prohibited_income !== "") {
    const [current] = await tx.select().from(financialFact).where(and(factKey(c.id, period.id, "prohibited_income"), eq(financialFact.is_current, true)));
    const data = {
      value: row.prohibited_income, input_state: "reported", confidence_tier: "Verified",
      reason: row.prohibited_income_note, periodId: period.id, period_start: period.period_start, period_end: period.period_end,
      source: { label: row.prohibited_income_source, source_type: "internal", document_reference: row.prohibited_income_note },
      ...(current ? { factId: current.id } : {}),
    };
    await mutateFinancial(tx, actor, { operation: current ? "override" : "addProhibitedIncome", securityId, data });
  }
}

export async function launchTickerReport(tx: Tx, securityId: string, row: LaunchRow, asOf: string) {
  const { c, period } = await securityContext(tx, securityId);
  const facts = period ? await tx.select().from(financialFact).where(and(eq(financialFact.company_id, c.id),
    eq(financialFact.period_id, period.id), eq(financialFact.is_current, true))) : [];
  const prices = await tx.select().from(priceBar).where(eq(priceBar.security_id, securityId));
  const shares = facts.find(f => f.line_item === "shares_outstanding");
  const basis = facts.find(f => f.line_item === "market_value_basis" && f.security_id === securityId);
  const income = facts.find(f => f.line_item === "prohibited_income");
  const [secShares] = period ? await tx.select().from(financialFact).where(and(
    factKey(c.id, period.id, "shares_outstanding"), eq(financialFact.origin, "sec")))
    .orderBy(desc(financialFact.as_of_date), desc(financialFact.created_at), desc(financialFact.id)).limit(1) : [];
  const segments = period ? await tx.select().from(businessSegment).where(and(
    eq(businessSegment.company_id, c.id), eq(businessSegment.period_id, period.id))) : [];
  const derivation = deriveMarketValue(asOf, prices, shares ? {
    ...shares, shares_class_concern: secShares ? secShares.shares_class_concern : shares.shares_class_concern,
  } : shares, facts.find(f => f.line_item === "total_equity"));
  const missing = facts.filter(f => !f.security_id && (f.value === null || ["unknown", "missing"].includes(f.input_state))).map(f => f.line_item);
  if (!period) missing.push("current annual period");
  for (const line of ["total_revenue", "interest_bearing_debt", "prohibited_income"])
    if (!facts.some(f => !f.security_id && f.line_item === line)) missing.push(line);
  if (!segments.length) missing.push("business_segments");
  if (segments.some(s => s.activity_category === "unclassified")) missing.push("classified primary activity");
  return { ticker: row.ticker, priceProvider: manualPriceProvider.name,
    closes: MONTH_ENDS.map(month => ({ month, close: selectMonthEnd(prices, month)?.close ?? null })),
    selectedQuarter: derivation.quarter.label, stale: derivation.trace.stale, freshnessNote: derivation.trace.freshnessNote,
    market_value_basis: basis?.value ?? null, activity_category: segments.length === 1 ? segments[0].activity_category : null,
    requested_activity_category: row.activity_category,
    prohibited_income: { supplied: row.prohibited_income !== "", value: income?.value ?? null,
      state: income?.input_state ?? "missing", note: income?.mapping_note ?? null },
    shareClassConcern: derivation.trace.gaps.filter(g => g.includes("classes")),
    missing: [...new Set([...missing, ...derivation.trace.gaps])] };
}
