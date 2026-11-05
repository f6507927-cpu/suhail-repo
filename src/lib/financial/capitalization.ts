import { and, eq, sql } from "drizzle-orm";
import { financialFact, priceBar } from "../../db/schema/market";
import { latestStoredClose } from "../../ingest/prices/selection";
import type { Tx } from "../auth/audit";
import { audit } from "../auth/audit";
import type { Actor } from "./persistence";
import type { PriceEvidence } from "./market-value";
import { weakest } from "../../engine/evidence";

/** D-157: market_cap is distinct from D-122's quarterly market_value_basis. */
export async function fillCapitalization(
  tx: Tx, actor: Actor, companyId: string, securityId: string, periodId: string,
  shares: typeof financialFact.$inferSelect | undefined, prices: PriceEvidence[], asOf: string,
) {
  const close = latestStoredClose(prices.filter(p => p.date <= asOf && p.month_end_for! <= asOf));
  if (!close || !shares?.source_id || shares.value === null || shares.value <= 0 ||
    !Number.isFinite(shares.value) || ["missing", "unknown"].includes(shares.input_state) ||
    shares.shares_class_concern) return;
  // Fill a missing new-period projection only. Never supersede manual,
  // protected, or existing per-security capitalization evidence.
  const current = await tx.select().from(financialFact).where(and(
    eq(financialFact.company_id, companyId), eq(financialFact.period_id, periodId),
    eq(financialFact.line_item, "market_cap"), eq(financialFact.is_current, true)));
  if (current.some(f => f.security_id === null || f.security_id === securityId)) return;
  const confidence = weakest(["Calculated", shares.confidence_tier, close.source_tier ?? "Verified"])!;
  const estimated = shares.input_state === "estimated" || close.is_synthetic ||
    confidence === "Estimated" || confidence === "AI Interpretation";
  const value = shares.value * close.close!;
  if (!Number.isFinite(value)) throw new Error("Market capitalization arithmetic overflow");
  const [fact] = await tx.insert(financialFact).values({
    company_id: companyId, period_id: periodId, line_item: "market_cap",
    label: "Market capitalization",
    value: sql<number>`(select value from ${financialFact} where ${financialFact.id}=${shares.id}) *
      (select close from ${priceBar} where ${priceBar.id}=${close.id})`, currency: "USD",
    origin: "market_value_basis", as_of_date: close.date, source_id: close.source_id,
    input_state: estimated ? "estimated" : "derived",
    confidence_tier: close.is_synthetic && confidence === "Calculated" ? "Estimated" : confidence,
    mapping_note: JSON.stringify({ rule: "D-157", sharesFact: shares.id, sharesSource: shares.source_id,
      sharesAsOf: shares.as_of_date, priceId: close.id, priceSource: close.source_id,
      priceDate: close.date, periodId }),
    calculation_version: "market-cap-2026.11.1", is_demo: shares.is_demo, created_by: actor?.id,
  }).returning();
  await audit(tx, actor, { event_type: "data_ingest", entity_name: "security", entity_id: securityId,
    summary: "New-period market capitalization derived", details: { factId: fact.id, periodId } });
}
