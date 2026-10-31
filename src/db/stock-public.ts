import "server-only";
import { cache } from "react";
import { and, desc, eq, getTableColumns, inArray, sql, or, isNull } from "drizzle-orm";
import { dbPublic } from "./public";
import { security, company, exchange, financialPeriod, financialFact, source, methodology, methodologyVersion, screeningRun, screeningCriterionResult, screeningUnknown, explanationObject, analystProfile } from "./schema";
import type { PublicStockData } from "../stock/types";

// D-20/D-36: explicit public column allowlists, not SELECT * or private settings.
function pick<T, K extends keyof T>(columns: T, ...keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, columns[key]])) as Pick<T, K>;
}
const securities = pick(getTableColumns(security), "id", "slug", "ticker", "display_symbol", "is_demo", "company_id", "exchange_id", "coverage_analyst_id");
const companies = pick(getTableColumns(company), "id", "name", "name_ar", "description_ar", "description_en", "sector_label", "is_demo");
const versions = pick(getTableColumns(methodologyVersion), "id", "version", "version_label", "production_enabled", "is_demo");
const methods = pick(getTableColumns(methodology), "name", "slug", "scope", "official_or_inspired", "is_demo");
const runs = pick(getTableColumns(screeningRun), "id", "status", "status_reasons", "confidence", "data_adequacy", "data_as_of", "generated_at", "immutable_hash", "calculation_version", "engine_version", "financial_period_id", "financial_period_label", "is_demo", "methodology_name", "methodology_version_label");
const criteria = pick(getTableColumns(screeningCriterionResult), "id", "screening_run_id", "criterion_id", "criterion_type", "criterion_label", "result", "numerator_value", "numerator_definition", "denominator_value", "denominator_definition", "ratio", "threshold", "threshold_unit", "threshold_direction", "borderline_margin", "input_states", "confidence_tier", "source_ids", "calculation_trace", "result_reason", "source_reference", "sort_order");
const unknowns = pick(getTableColumns(screeningUnknown), "id", "screening_run_id", "criterion_id", "criterion_type", "criterion_label", "field_or_input", "why_missing", "effect", "source_reference", "severity");
const facts = pick(getTableColumns(financialFact), "id", "line_item", "label", "value", "value_text", "currency", "unit_scale", "input_state", "confidence_tier", "source_id", "unknown_note");
const sources = pick(getTableColumns(source), "id", "label", "source_type", "document_title", "document_reference", "source_url", "reporting_period");
const analysts = pick(getTableColumns(analystProfile), "name_ar", "name_en", "title_ar", "title_en", "credentials", "bio_ar", "bio_en", "headshot_object_key");

// Injectable database is for actual loopback-role integration, never auth bypass.
export async function loadPublicStock(slug: string, db: Pick<typeof dbPublic, "select" | "execute"> = dbPublic): Promise<PublicStockData | null> {
  const [s] = await db.select(securities).from(security).where(and(eq(security.slug, slug), eq(security.in_universe, true), eq(security.listing_status, "listed"))).limit(1);
  if (!s) return null;
  const [c] = await db.select(companies).from(company).where(eq(company.id, s.company_id!)).limit(1);
  if (!c) return null;
  const [e] = s.exchange_id ? await db.select({ code: exchange.code, name: exchange.name }).from(exchange).where(eq(exchange.id, s.exchange_id)).limit(1) : [];
  const [analyst] = s.coverage_analyst_id ? await db.select(analysts).from(analystProfile).where(and(eq(analystProfile.id, s.coverage_analyst_id), eq(analystProfile.active, true))).limit(1) : [];
  const setting = await db.execute<{ default_shariah_methodology_version_id: string | null }>(sql`select default_shariah_methodology_version_id from app.public_settings limit 1`);
  const versionId = setting[0]?.default_shariah_methodology_version_id;
  const [definition] = versionId ? await db.select({ version: versions, methodology: methods }).from(methodologyVersion).innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id)).where(and(eq(methodologyVersion.id, versionId), eq(methodologyVersion.is_public, true))).limit(1) : [];
  const base: PublicStockData = { security: s, company: c, exchange: e ?? null, analyst: analyst ?? null, version: definition?.version ?? null, methodology: definition?.methodology ?? null, run: null, priorRuns: [], criteria: [], unknowns: [], explanation: null, period: null, facts: [], sources: [] };
  if (!definition) return base;
  const history = await db.select(runs).from(screeningRun).where(and(eq(screeningRun.security_id, s.id), eq(screeningRun.methodology_version_id, definition.version.id))).orderBy(desc(screeningRun.generated_at), desc(screeningRun.created_at), desc(screeningRun.id));
  const [run, ...priorRuns] = history;
  if (!run) return base;
  const [period] = run.financial_period_id ? await db.select({ id: financialPeriod.id, fiscal_period_label: financialPeriod.fiscal_period_label, period_end: financialPeriod.period_end, reported_date: financialPeriod.reported_date, source_id: financialPeriod.source_id }).from(financialPeriod).where(eq(financialPeriod.id, run.financial_period_id)).limit(1) : [];
  const [criterionRows, unknownRows, explanationRows, factRows] = await Promise.all([
    db.select(criteria).from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, run.id)).orderBy(screeningCriterionResult.sort_order, screeningCriterionResult.id),
    db.select(unknowns).from(screeningUnknown).where(eq(screeningUnknown.screening_run_id, run.id)).orderBy(screeningUnknown.id),
    db.select(pick(getTableColumns(explanationObject), "id", "ai_text", "validation_status", "evidence", "unknowns")).from(explanationObject).where(eq(explanationObject.screening_run_id, run.id)).orderBy(desc(explanationObject.generated_at), desc(explanationObject.id)).limit(1),
    period ? db.select(facts).from(financialFact).where(and(eq(financialFact.company_id, c.id), eq(financialFact.period_id, period.id), eq(financialFact.is_current, true), or(isNull(financialFact.security_id), eq(financialFact.security_id, s.id)))).orderBy(financialFact.line_item) : Promise.resolve([]),
  ]);
  const ids = [...new Set([...criterionRows.flatMap((row) => row.source_ids), ...factRows.flatMap((row) => row.source_id ? [row.source_id] : []), ...(period?.source_id ? [period.source_id] : [])])];
  const sourceRows = ids.length ? await db.select(sources).from(source).where(inArray(source.id, ids)).orderBy(source.id) : [];
  // Never catch a failed read into a successful cached page (D-102 classic ISR).
  return { ...base, run, priorRuns, period: period ?? null, criteria: criterionRows, unknowns: unknownRows, explanation: explanationRows[0] ?? null, facts: factRows, sources: sourceRows };
}
export const getPublicStockData = cache((slug: string) => loadPublicStock(slug));
