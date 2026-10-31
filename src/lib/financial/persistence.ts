import "server-only";
import { and, eq, desc, sql, isNull, type SQL } from "drizzle-orm";
import { refreshCompanyMarketValues } from "./market-value-persistence";
import { createHash } from "node:crypto";
import { company, security, source, financialPeriod, financialFact } from "../../db/schema/market";
import { audit, type Tx, type AppUser } from "../auth/audit";
import type { mapAnnual } from "../../ingest/sec/annual";
import type { FilingSource } from "../../ingest/sec/types";

export type Actor = Pick<AppUser, "id" | "email" | "role"> | null;
export function requireFinancial(value: unknown, message: string): asserts value {
  if (!value) throw new FinancialError(message);
}
export class FinancialError extends Error {}
export const factKey = (companyId: string, periodId: string, line: string) =>
  and(eq(financialFact.company_id, companyId), eq(financialFact.period_id, periodId), eq(financialFact.line_item, line), isNull(financialFact.security_id));
export async function securityContext(tx: Tx, id: string) {
  const [s] = await tx.select().from(security).where(eq(security.id, id));
  requireFinancial(s?.company_id, "Security not found");
  const [c] = await tx.select().from(company).where(eq(company.id, s.company_id)).for("update");
  requireFinancial(c, "Company not found");
  const [period] = await tx.select().from(financialPeriod).where(and(
    eq(financialPeriod.company_id, c.id), eq(financialPeriod.period_type, "annual"), eq(financialPeriod.is_latest, true)));
  return { s, c, period };
}
async function filingSource(tx: Tx, actor: Actor, value: FilingSource) {
  const [existing] = await tx.select().from(source).where(and(
    eq(source.provider, value.provider), eq(source.document_reference, value.document_reference),
    eq(source.source_url, value.source_url)));
  if (existing) return existing.id;
  const { filed: _filed, ...fields } = value;
  void _filed;
  const [row] = await tx.insert(source).values({ ...fields,
    retrieved_at: new Date(value.retrieved_at), created_by: actor?.id }).returning();
  return row.id;
}
type FactInsert = Omit<typeof financialFact.$inferInsert, "value"> & { value?: number | SQL | null };
export async function insertCurrent(tx: Tx, values: FactInsert) {
  await tx.update(financialFact).set({ is_current: false }).where(and(
    factKey(values.company_id, values.period_id, values.line_item), eq(financialFact.is_current, true)));
  const [row] = await tx.insert(financialFact).values({ ...values, is_current: true }).returning();
  return row;
}
/** D-09/D-114: lock issuer, then supersede; preserve each actual filing's source. */
export async function persistAnnual(tx: Tx, actor: Actor, companyId: string, mapped: ReturnType<typeof mapAnnual>) {
  await tx.select().from(company).where(eq(company.id, companyId)).for("update");
  const periodSource = await filingSource(tx, actor, mapped.period.source);
  const [existing] = await tx.select().from(financialPeriod).where(and(
    eq(financialPeriod.company_id, companyId), eq(financialPeriod.period_type, "annual"),
    eq(financialPeriod.fiscal_year, mapped.period.fiscal_year),
    eq(financialPeriod.fiscal_period_label, mapped.period.fiscal_period_label)));
  await tx.update(financialPeriod).set({ is_latest: false }).where(and(
    eq(financialPeriod.company_id, companyId), eq(financialPeriod.period_type, "annual"),
    eq(financialPeriod.is_latest, true)));
  const { source: _source, ...periodValues } = mapped.period;
  void _source;
  const fields = { ...periodValues, company_id: companyId, source_id: periodSource };
  const [period] = existing
    ? await tx.update(financialPeriod).set(fields).where(eq(financialPeriod.id, existing.id)).returning()
    : await tx.insert(financialPeriod).values({ ...fields, created_by: actor?.id }).returning();
  let inserted = 0, retained = 0, promoted = 0;
  for (const f of mapped.facts) {
    const sourceId = f.source ? await filingSource(tx, actor, f.source) : periodSource;
    // Retrieval time is not a change in filing evidence.
    const evidenceKey = createHash("sha256").update(JSON.stringify([
      companyId, period.id, f.line_item, f.value, f.input_state, f.confidence_tier,
      sourceId, f.as_of_date, f.mapping_note, f.unknown_note, f.calculation_version,
      ...(f.shares_class_concern ? ["explicit-cover-share-class-concern"] : []),
    ])).digest("hex");
    const [seen] = await tx.select().from(financialFact).where(eq(financialFact.evidence_key, evidenceKey));
    const [current] = await tx.select().from(financialFact).where(and(
      factKey(companyId, period.id, f.line_item), eq(financialFact.is_current, true)));
    if (seen) {
      if (!current?.protected_current && current?.id !== seen.id) {
        await tx.update(financialFact).set({ is_current: false }).where(and(
          factKey(companyId, period.id, f.line_item), eq(financialFact.is_current, true)));
        await tx.update(financialFact).set({ is_current: true }).where(eq(financialFact.id, seen.id));
        promoted++;
      }
      continue;
    }
    const values: typeof financialFact.$inferInsert = {
      company_id: companyId, period_id: period.id, line_item: f.line_item,
      value: f.value, currency: f.currency, input_state: f.input_state, confidence_tier: f.confidence_tier,
      source_id: sourceId, as_of_date: f.as_of_date, mapping_note: f.mapping_note,
      unknown_note: f.unknown_note, calculation_version: f.calculation_version,
      shares_class_concern: f.shares_class_concern ?? false,
      evidence_key: evidenceKey, origin: "sec", protected_current: false,
      is_demo: mapped.period.is_demo, created_by: actor?.id,
    };
    if (f.line_item === "shares_outstanding") {
      // Repeated filings/corrections can arrive in one transaction: default now()
      // ties are not evidence ordering. Preserve latest cover evidence even when
      // the current analyst correction is protected.
      const previous = await latestSec(tx, companyId, period.id, f.line_item);
      values.created_at = new Date(Math.max(Date.now(), previous ? +previous.created_at + 1 : 0));
    }
    if (current?.protected_current) {
      await tx.insert(financialFact).values({ ...values, is_current: false }); retained++;
    } else {
      await insertCurrent(tx, values);
    }
    inserted++;
  }
  if (inserted || promoted) await audit(tx, actor, { event_type: "data_ingest", entity_name: "company",
    entity_id: companyId, summary: "SEC annual financial evidence imported",
    details: { period_id: period.id, inserted, retained, promoted, calculation_version: mapped.calculation_version } });
  await refreshCompanyMarketValues(tx, actor, companyId, new Date().toISOString().slice(0, 10));
  return { inserted, retained, promoted, periodId: period.id };
}
export async function latestSec(tx: Tx, companyId: string, periodId: string, line: string) {
  const [row] = await tx.select().from(financialFact).where(and(
    factKey(companyId, periodId, line), eq(financialFact.origin, "sec")))
    .orderBy(desc(financialFact.created_at), desc(financialFact.id)).limit(1);
  return row;
}
// SQL arithmetic preserves database decimal precision; do not multiply rounded UI values.
export const decimal = (value: string) => sql<number>`${value}::numeric`;
