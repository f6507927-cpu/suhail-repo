import "server-only";
import { and, eq, or, sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { priceBar, priceProviderStatus, priceTargetClaim, security, source } from "../../db/schema/market";
import { securityContext } from "../../lib/financial/persistence";
import { refreshMarketValue } from "../../lib/financial/market-value-persistence";
import { audit } from "../../lib/auth/audit";
import { NINJAS, type Target } from "./api-ninjas";
import type { BudgetStore, RunStore } from "./run";
import { assertWindow, monthWindow } from "./calendar";

/** Short row-locked transaction commits before HTTP; failed calls remain charged. Database
 * clock prevents a CLI historical month from resetting the call budget. Lowering
 * the configured cap cannot be evaded by another process with the old cap.
 */
export const budgetStore: BudgetStore = {
  async reserveCall(month, cap) {
    return dbApp.transaction(async tx => {
      // Always persist a lower cap, even when usage already exceeds it. The
      // upsert keeps the month row locked through the conditional increment.
      const current = await tx.execute(sql`
        insert into app.price_call_usage(month, used, cap)
        select ${month}, 0, ${cap}
        where ${month} = to_char(clock_timestamp() at time zone 'America/New_York', 'YYYY-MM')
        on conflict (month) do update set cap = least(price_call_usage.cap, excluded.cap)
        returning month`);
      if (!current.length) return false;
      const reserved = await tx.execute(sql`
        update app.price_call_usage set used = used + 1
        where month = ${month} and used < cap
          and month = to_char(clock_timestamp() at time zone 'America/New_York', 'YYYY-MM')
        returning used`);
      // A denied reservation still commits the lower cap, but never permits HTTP.
      return reserved.length === 1;
    });
  },
};
export async function coveredTargets(): Promise<Target[]> {
  const rows = await dbApp.select({ id: security.id, ticker: security.ticker,
    exchange: security.exchange_code, currency: security.currency }).from(security)
    .where(and(eq(security.in_universe, true), eq(security.listing_status, "listed"))).orderBy(security.ticker);
  return rows.filter((s): s is Target => s.exchange !== null &&
    ["NYSE", "NASDAQ"].includes(s.exchange) && s.currency === "USD");
}
export const realStore: RunStore = {
  ...budgetStore, targets: coveredTargets,
  async claim(target, date, monthEnd) {
    return dbApp.transaction(async tx => {
      // Same issuer row lock as analyst/CSV corrections, never held across HTTP.
      const { s } = await securityContext(tx, target.id);
      if (!s.in_universe || s.listing_status !== "listed" || s.ticker !== target.ticker ||
        s.exchange_code !== target.exchange || s.currency !== "USD") return false;
      const existing = await tx.select({ id: priceBar.id }).from(priceBar).where(and(
        eq(priceBar.security_id, target.id), or(eq(priceBar.date, date), eq(priceBar.month_end_for, monthEnd)))).limit(1);
      if (existing.length) return false;
      const claims = await tx.insert(priceTargetClaim).values({ security_id: target.id, month_end_for: monthEnd })
        .onConflictDoNothing().returning();
      return claims.length === 1;
    });
  },
  async save(target, close) {
    await dbApp.transaction(async tx => {
      const { s, c } = await securityContext(tx, target.id);
      if (!s.in_universe || s.listing_status !== "listed" || s.ticker !== target.ticker ||
        s.exchange_code !== target.exchange || s.currency !== "USD") throw new Error("Target changed");
      const held = await tx.select({ id: priceBar.id }).from(priceBar).where(and(
        eq(priceBar.security_id, s.id), or(eq(priceBar.date, close.date), eq(priceBar.month_end_for, close.monthEnd)))).limit(1);
      // A manual correction arriving during HTTP wins, without losing its history.
      if (held.length) return;
      // Issuer-lock waits may cross the next close after HTTP has completed.
      const [clock] = await tx.execute<{ now: Date }>(sql`select clock_timestamp() as now`);
      assertWindow(monthWindow(close.monthEnd.slice(0, 7)), new Date(clock.now));
      const [provenance] = await tx.insert(source).values({ label: NINJAS, provider: NINJAS,
        source_type: "data_provider", source_url: close.sourceUrl, retrieved_at: close.retrieved,
        reporting_period: close.monthEnd, document_reference: `updated=${close.updated.toISOString()}`,
        confidence_tier: "Verified", is_synthetic: false }).returning();
      const [price] = await tx.insert(priceBar).values({ security_id: s.id, ticker: s.ticker,
        date: close.date, month_end_for: close.monthEnd, close: close.close, currency: "USD",
        price_provider: NINJAS, provider_updated_at: close.updated, source_id: provenance.id,
        source_label: NINJAS, source_url: close.sourceUrl, is_synthetic: false }).returning();
      await refreshMarketValue(tx, null, c.id, s.id, close.retrieved.toISOString().slice(0, 10));
      await audit(tx, null, { event_type: "data_ingest", entity_name: "security", entity_id: s.id,
        summary: "Stored API Ninjas month-end close", details: { priceId: price.id, monthEnd: close.monthEnd } });
    });
  },
  async unavailable(reason) {
    await dbApp.insert(priceProviderStatus).values({ provider: NINJAS, reason, occurred_at: new Date() })
      .onConflictDoUpdate({ target: priceProviderStatus.provider, set: { reason, occurred_at: new Date() } });
  },
};
// Explicit read-only PriceProvider boundary: pages and screening never fetch.
export const apiNinjasPriceProvider = {
  name: NINJAS,
  licenceNote: "Free tier prohibits commercial use; attribution is not permission.",
  getCloses: (id: string, from: string, to: string) => dbApp.select().from(priceBar).where(and(
    eq(priceBar.security_id, id), eq(priceBar.price_provider, NINJAS),
    sql`${priceBar.date} >= ${from}`, sql`${priceBar.date} <= ${to}`)),
} satisfies import("./manual").PriceProvider;
