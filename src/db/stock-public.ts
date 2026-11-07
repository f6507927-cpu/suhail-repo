import "server-only";
import { cache } from "react";
import { and, desc, eq, getTableColumns, inArray, ne, notInArray, sql, or, isNull } from "drizzle-orm";
import { dbPublic } from "./public";
import { security, company, exchange, financialPeriod, financialFact, source, methodology, methodologyVersion, methodologyCriterion, screeningRun, screeningCriterionResult, screeningUnknown, explanationObject, analystProfile, pick as editorialPick, edition } from "./schema";
import type { OtherMethodologyResult, PublicStockData } from "../stock/types";
import { priceBar } from "./schema/market";
import { genuineMethodology, genuineMethodologyVersion, genuineSource, hidePublicDemo } from "./public-visibility";
import { latestStoredClose } from "../ingest/prices/selection";
import { apiNinjasStorageReady } from "../ingest/prices/storage-ready";

// D-20/D-36: explicit public column allowlists, not SELECT * or private settings.
function pick<T, K extends keyof T>(columns: T, ...keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, columns[key]])) as Pick<T, K>;
}
const securities = pick(getTableColumns(security), "id", "slug", "ticker", "display_symbol", "is_demo", "company_id", "exchange_id", "coverage_analyst_id");
const companies = pick(getTableColumns(company), "id", "name", "name_ar", "display_name_en", "description_ar", "description_en", "sector_label", "is_demo");
const versions = pick(getTableColumns(methodologyVersion), "id", "version", "version_label", "production_enabled", "is_demo", "workflow_status");
const methods = pick(getTableColumns(methodology), "name", "slug", "scope", "official_or_inspired", "is_demo");
const runs = pick(getTableColumns(screeningRun), "id", "status", "status_reasons", "confidence", "data_adequacy", "data_as_of", "generated_at", "immutable_hash", "calculation_version", "engine_version", "financial_period_id", "financial_period_label", "is_demo", "methodology_name", "methodology_version_label");
const criteria = pick(getTableColumns(screeningCriterionResult), "id", "screening_run_id", "criterion_id", "criterion_type", "criterion_label", "result", "numerator_value", "numerator_definition", "denominator_value", "denominator_definition", "ratio", "threshold", "threshold_unit", "threshold_direction", "borderline_margin", "input_states", "confidence_tier", "source_ids", "calculation_trace", "result_reason", "source_reference", "sort_order");
const unknowns = pick(getTableColumns(screeningUnknown), "id", "screening_run_id", "criterion_id", "criterion_type", "criterion_label", "field_or_input", "why_missing", "effect", "source_reference", "severity");
const facts = pick(getTableColumns(financialFact), "id", "line_item", "label", "value", "value_text", "currency", "unit_scale", "input_state", "confidence_tier", "source_id", "unknown_note");
const sources = pick(getTableColumns(source), "id", "label", "source_type", "document_title", "document_reference", "source_url", "reporting_period");
const analysts = pick(getTableColumns(analystProfile), "name_ar", "name_en", "title_ar", "title_en", "credentials", "bio_ar", "bio_en", "headshot_object_key");

// Injectable database is for actual loopback-role integration, never auth bypass.
export async function loadPublicStock(slug: string, db: Pick<typeof dbPublic, "select" | "execute"> = dbPublic): Promise<PublicStockData | null> {
  // Outside explicit local fixtures, demo issuers, demo/example methodologies,
  // demo runs/editions and synthetic closes/sources are never public.
  const hideDemo = hidePublicDemo();
  const [s] = await db.select(securities).from(security).where(and(eq(security.slug, slug), eq(security.in_universe, true), eq(security.listing_status, "listed"), hideDemo ? eq(security.is_demo, false) : undefined)).limit(1);
  if (!s) return null;
  const [c] = await db.select(companies).from(company).where(and(eq(company.id, s.company_id!), hideDemo ? eq(company.is_demo, false) : undefined)).limit(1);
  if (!c) return null;
  const closeRows = apiNinjasStorageReady() ? await db.select(pick(getTableColumns(priceBar), "id", "created_at", "date",
    "month_end_for", "close", "currency", "source_id", "price_provider", "source_label", "source_url"))
    .from(priceBar).where(and(eq(priceBar.security_id, s.id), hideDemo ? and(eq(priceBar.is_synthetic, false), eq(priceBar.is_demo, false)) : undefined)) : [];
  const storedClose = latestStoredClose(closeRows);
  const [e] = s.exchange_id ? await db.select({ code: exchange.code, name: exchange.name }).from(exchange).where(eq(exchange.id, s.exchange_id)).limit(1) : [];
  const [analyst] = s.coverage_analyst_id ? await db.select(analysts).from(analystProfile).where(and(eq(analystProfile.id, s.coverage_analyst_id), eq(analystProfile.active, true))).limit(1) : [];
  const setting = await db.execute<{ default_shariah_methodology_version_id: string | null }>(sql`select default_shariah_methodology_version_id from app.public_settings limit 1`);
  const versionId = setting[0]?.default_shariah_methodology_version_id;
  const [definition] = versionId ? await db.select({ version: versions, methodology: methods }).from(methodologyVersion).innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id)).where(and(eq(methodologyVersion.id, versionId), eq(methodologyVersion.is_public, true), genuineMethodologyVersion(), genuineMethodology())).limit(1) : [];
  const base: PublicStockData = { security: s, company: c, exchange: e ?? null, analyst: analyst ?? null, version: definition?.version ?? null, methodology: definition?.methodology ?? null, run: null, priorRuns: [], criteria: [], unknowns: [], explanation: null, period: null, facts: [], sources: [] };
  base.storedClose = storedClose;
  if (!definition) return base;
  // Shown even when the default methodology has no run for this stock yet.
  base.otherMethodologies = await loadOtherMethodologies(db, s.id, definition.version.id, hideDemo);
  const history = await db.select(runs).from(screeningRun).where(and(eq(screeningRun.security_id, s.id), eq(screeningRun.methodology_version_id, definition.version.id), hideDemo ? eq(screeningRun.is_demo, false) : undefined)).orderBy(desc(screeningRun.generated_at), desc(screeningRun.created_at), desc(screeningRun.id));
  const [run, ...priorRuns] = history;
  if (!run) return base;
  const [period] = run.financial_period_id ? await db.select({ id: financialPeriod.id, fiscal_period_label: financialPeriod.fiscal_period_label, period_end: financialPeriod.period_end, reported_date: financialPeriod.reported_date, source_id: financialPeriod.source_id }).from(financialPeriod).where(eq(financialPeriod.id, run.financial_period_id)).limit(1) : [];
  const [criterionRows, unknownRows, explanationRows, factRows] = await Promise.all([
    // D-147: join only explanatory UI; run labels, calculations and evidence stay immutable.
    db.select({ ...criteria, explanation_ar: methodologyCriterion.explanation_ar, explanation_en: methodologyCriterion.explanation_en })
      .from(screeningCriterionResult).leftJoin(methodologyCriterion, and(
        eq(methodologyCriterion.id, screeningCriterionResult.criterion_id),
        eq(methodologyCriterion.methodology_version_id, definition.version.id),
      )).where(eq(screeningCriterionResult.screening_run_id, run.id)).orderBy(screeningCriterionResult.sort_order, screeningCriterionResult.id),
    db.select(unknowns).from(screeningUnknown).where(eq(screeningUnknown.screening_run_id, run.id)).orderBy(screeningUnknown.id),
    db.select(pick(getTableColumns(explanationObject), "id", "ai_text", "validation_status", "evidence", "unknowns")).from(explanationObject).where(eq(explanationObject.screening_run_id, run.id)).orderBy(desc(explanationObject.generated_at), desc(explanationObject.id)).limit(1),
    // D-155: prepared bound inputs/context appear in v1.1 criterion evidence/trace,
    // not as raw internal keys or JSON in the ordinary fundamentals table.
    period ? db.select(facts).from(financialFact).where(and(eq(financialFact.company_id, c.id), eq(financialFact.period_id, period.id), eq(financialFact.is_current, true), notInArray(financialFact.line_item, ["sec_sic_code", "suhail_bound_cash", "suhail_bound_short_term_securities", "suhail_bound_long_term_securities", "suhail_bound_context", "suhail_bound_eligible"]), or(isNull(financialFact.security_id), eq(financialFact.security_id, s.id)))).orderBy(financialFact.line_item) : Promise.resolve([]),
  ]);
  const ids = [...new Set([...criterionRows.flatMap((row) => row.source_ids), ...factRows.flatMap((row) => row.source_id ? [row.source_id] : []), ...(period?.source_id ? [period.source_id] : [])])];
  const sourceRows = ids.length ? await db.select(sources).from(source).where(and(inArray(source.id, ids), genuineSource())).orderBy(source.id) : [];
  // No edition route exists yet: link to the actual published research in this
  // page's full record, rather than inventing an unreachable edition URL.
  const [publishedPick] = s.coverage_analyst_id && run.status === "passes_selected_methodology"
    ? await db.select({
      href: sql<string>`'#stock-published-research'`,
      thesis_ar: editorialPick.editor_thesis_ar, thesis_en: editorialPick.editor_thesis_en,
      why_now_ar: editorialPick.editor_why_now_ar, why_now_en: editorialPick.editor_why_now_en,
      risks_ar: editorialPick.risks_ar, risks_en: editorialPick.risks_en,
      valuation_ar: editorialPick.editor_valuation_context_ar, valuation_en: editorialPick.editor_valuation_context_en,
      disclosure_ar: editorialPick.editor_conflict_disclosure_ar, disclosure_en: editorialPick.editor_conflict_disclosure_en,
      disclaimer: editorialPick.disclaimer, edition_label: edition.edition_id,
    }).from(editorialPick).innerJoin(edition, eq(edition.id, editorialPick.edition_id))
      .where(and(eq(editorialPick.security_id, s.id), inArray(edition.status, hideDemo ? ["published_live"] : ["published_demo", "published_live"]),
        hideDemo ? and(eq(edition.is_demo, false), eq(editorialPick.is_demo, false)) : undefined))
      .orderBy(desc(edition.published_at), desc(editorialPick.id)).limit(1) : [];
  // Never catch a failed read into a successful cached page (D-102 classic ISR).
  return { ...base, publishedPick: publishedPick ?? null, run, priorRuns, period: period ?? null, criteria: criterionRows, unknowns: unknownRows, explanation: explanationRows[0] ?? null, facts: factRows, sources: sourceRows };
}
/** D-174: each other production-enabled, public, genuine methodology's latest
 * run for this security, side by side and never combined into one score. */
export async function loadOtherMethodologies(db: Pick<typeof dbPublic, "select">, securityId: string, defaultVersionId: string, hideDemo: boolean): Promise<OtherMethodologyResult[]> {
  const definitions = await db.select({
    methodology: { name: methodology.name, slug: methodology.slug, short_label: methodology.short_label },
    version: { id: methodologyVersion.id, version: methodologyVersion.version, version_label: methodologyVersion.version_label },
  }).from(methodologyVersion).innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id))
    .where(and(eq(methodologyVersion.is_public, true), eq(methodologyVersion.production_enabled, true),
      ne(methodologyVersion.id, defaultVersionId), genuineMethodologyVersion(), genuineMethodology()))
    .orderBy(methodology.name, methodologyVersion.id);
  const results: OtherMethodologyResult[] = [];
  for (const definition of definitions) {
    const [latest] = await db.select(pick(getTableColumns(screeningRun), "id", "status", "status_reasons", "generated_at", "data_as_of", "financial_period_label"))
      .from(screeningRun).where(and(eq(screeningRun.security_id, securityId), eq(screeningRun.methodology_version_id, definition.version.id),
        hideDemo ? eq(screeningRun.is_demo, false) : undefined))
      .orderBy(desc(screeningRun.generated_at), desc(screeningRun.created_at), desc(screeningRun.id)).limit(1);
    const criteria = latest ? await db.select(pick(getTableColumns(screeningCriterionResult), "criterion_id", "criterion_label", "criterion_type", "result",
      "ratio", "threshold", "threshold_unit", "threshold_direction", "numerator_value", "denominator_value", "numerator_definition", "sort_order"))
      .from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, latest.id))
      .orderBy(screeningCriterionResult.sort_order, screeningCriterionResult.id) : [];
    results.push({ ...definition, run: latest ?? null, criteria });
  }
  return results;
}
export const getPublicStockData = cache((slug: string) => loadPublicStock(slug));
