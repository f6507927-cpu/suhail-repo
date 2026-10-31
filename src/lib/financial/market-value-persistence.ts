import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, or, inArray, desc } from "drizzle-orm";
import { financialFact, financialPeriod, priceBar, security, source } from "../../db/schema/market";
import type { Tx } from "../auth/audit";
import { audit } from "../auth/audit";
import { deriveMarketValue } from "./market-value";
import type { Actor } from "./persistence";
// Denominator derivation changed, not SEC annual mapping or engine evaluation.
export const MARKET_VALUE_CALCULATION_VERSION = "calc-2026.10.5";

/** Restrict shared facts plus this share class; do not leak another denominator. */
export const securityFacts = (id: string) => or(isNull(financialFact.security_id), eq(financialFact.security_id, id));

// Issuer lock is held by every caller. This module deliberately does not import
// persistence.ts at runtime, avoiding a refresh/import dependency cycle.
export async function refreshMarketValue(tx: Tx, actor: Actor, companyId: string, securityId: string, asOf: string) {
  const [period] = await tx.select().from(financialPeriod).where(and(
    eq(financialPeriod.company_id, companyId), eq(financialPeriod.period_type, "annual"), eq(financialPeriod.is_latest, true)));
  if (!period) return;
  const facts = await tx.select().from(financialFact).where(and(eq(financialFact.company_id, companyId),
    eq(financialFact.period_id, period.id), eq(financialFact.is_current, true), isNull(financialFact.security_id)));
  const prices = await tx.select().from(priceBar).where(eq(priceBar.security_id, securityId));
  const sourceIds = prices.flatMap(p => p.source_id ? [p.source_id] : []);
  const priceSources = sourceIds.length ? await tx.select().from(source).where(inArray(source.id, sourceIds)) : [];
  const evidence = prices.map(p => ({ ...p, source_tier: priceSources.find(s => s.id === p.source_id)?.confidence_tier }));
  const [secShares] = await tx.select().from(financialFact).where(and(
    eq(financialFact.company_id, companyId), eq(financialFact.period_id, period.id),
    eq(financialFact.line_item, "shares_outstanding"), eq(financialFact.origin, "sec")))
    .orderBy(desc(financialFact.as_of_date), desc(financialFact.created_at), desc(financialFact.id)).limit(1);
  const shares = facts.find(f => f.line_item === "shares_outstanding");
  const result = deriveMarketValue(asOf, evidence, shares ? {
    ...shares, shares_class_concern: secShares ? secShares.shares_class_concern : shares.shares_class_concern,
  } : shares, facts.find(f => f.line_item === "total_equity"));
  const trace = JSON.stringify(result.trace);
  const key = createHash("sha256").update(JSON.stringify([securityId, period.id, trace, MARKET_VALUE_CALCULATION_VERSION])).digest("hex");
  const scope = and(eq(financialFact.company_id, companyId), eq(financialFact.period_id, period.id),
    eq(financialFact.security_id, securityId), eq(financialFact.line_item, "market_value_basis"));
  const [current] = await tx.select().from(financialFact).where(and(scope, eq(financialFact.is_current, true)));
  if (current?.evidence_key === key) return current;
  const [seen] = await tx.select().from(financialFact).where(eq(financialFact.evidence_key, key));
  await tx.update(financialFact).set({ is_current: false }).where(and(scope, eq(financialFact.is_current, true)));
  let next = seen;
  if (seen) {
    await tx.update(financialFact).set({ is_current: true }).where(eq(financialFact.id, seen.id));
  } else {
    const [s] = await tx.insert(source).values({ label: `Market value basis — ${result.quarter.label}`,
      source_type: "internal", provider: "Suhail calculation D-122", confidence_tier: result.confidence_tier,
      reporting_period: result.quarter.monthEnds[2], document_reference: key, notes: trace,
      is_synthetic: prices.filter(p => result.trace.months.some(m => m.price?.id === p.id)).some(p => p.is_synthetic),
      is_demo: period.is_demo, created_by: actor?.id }).returning();
    [next] = await tx.insert(financialFact).values({ company_id: companyId, period_id: period.id, security_id: securityId,
      line_item: "market_value_basis", label: "Market value basis", value: result.value, currency: "USD",
      input_state: result.input_state, confidence_tier: result.confidence_tier, origin: "market_value_basis",
      source_id: s.id, as_of_date: result.quarter.monthEnds[2], mapping_note: trace, unknown_note: result.unknown_note,
      calculation_version: MARKET_VALUE_CALCULATION_VERSION, evidence_key: key, is_demo: period.is_demo, created_by: actor?.id }).returning();
  }
  await audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: securityId,
    summary: "Market value basis refreshed", details: { factId: next.id, quarter: result.quarter.label } });
  return next;
}

export async function refreshCompanyMarketValues(tx: Tx, actor: Actor, companyId: string, asOf: string) {
  const securities = await tx.select().from(security).where(eq(security.company_id, companyId));
  for (const s of securities) await refreshMarketValue(tx, actor, companyId, s.id, asOf);
}
