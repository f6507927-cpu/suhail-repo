import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { company, security, source, financialPeriod, financialFact, priceBar } from "../../db/schema/market";
import { methodology, methodologyVersion } from "../../db/schema/methodology";
import { screeningRun, screeningCriterionResult, screeningUnknown } from "../../db/schema/screening";
import { buildResearchPacket, FINANCIAL_FIELDS } from "../../ai/research/packet";
import { runSchema } from "../../ai/research/contracts";
import type { PacketInput, ResearchPacketLoader, Source } from "../../ai/research/contracts";
import { activityEvidence } from "../financial/activity-evidence";
import { latestResearchFilings } from "./filings";

type Db = Pick<typeof dbApp, "select" | "execute">;
function sourceRef(row: typeof source.$inferSelect): Source {
  if (row.is_demo || row.is_synthetic || row.production_blocked) throw new Error("Ineligible research evidence source");
  return { id: row.id, label: row.label, url: row.source_url, accession: row.document_reference,
    is_synthetic: row.is_synthetic, production_blocked: row.production_blocked };
}
/** D-189: read only stored evidence; never SEC downloads or joins to personal data.
 * Coverage is projected to a boolean. Loader owns no write transaction/role lock.
 */
export class StoredResearchPacketLoader implements ResearchPacketLoader {
  constructor(private readonly db: Db = dbApp, private readonly asOf = new Date().toISOString()) {}
  async loadRows(securityId: string): Promise<PacketInput> {
    const [identity] = await this.db.select({
      security: { id: security.id, ticker: security.ticker, in_universe: security.in_universe,
        is_demo: security.is_demo, demo_label: security.demo_label },
      company: { id: company.id, name: company.name, is_demo: company.is_demo },
    }).from(security).innerJoin(company, eq(company.id, security.company_id)).where(eq(security.id, securityId));
    if (!identity || identity.security.is_demo || identity.company.is_demo || identity.security.demo_label)
      throw new Error("Research requires a genuine stored security");
    const [coverage] = await this.db.select({ covered: security.id }).from(security)
      .where(and(eq(security.id, securityId), or(isNull(security.coverage_analyst_id), isNull(security.company_id))));
    const periods = await this.db.select().from(financialPeriod).where(and(
      eq(financialPeriod.company_id, identity.company.id), eq(financialPeriod.period_type, "annual")))
      .orderBy(desc(financialPeriod.period_end), desc(financialPeriod.reported_date)).limit(2);
    if (periods.some(p => p.is_demo || !p.period_end || !p.reported_date)) throw new Error("Annual evidence dates are incomplete");
    const periodIds = periods.map(p => p.id);
    const facts = periodIds.length ? await this.db.select().from(financialFact).where(and(
      inArray(financialFact.period_id, periodIds), eq(financialFact.is_current, true),
      or(isNull(financialFact.security_id), eq(financialFact.security_id, securityId)))) : [];
    const sourceIds = [...new Set([...periods.map(p => p.source_id), ...facts.map(f => f.source_id)].filter((id): id is string => !!id))];
    const sources = sourceIds.length ? await this.db.select().from(source).where(inArray(source.id, sourceIds)) : [];
    const sourceById = new Map(sources.map(s => [s.id, s]));
    const resolved = (id: string | null) => {
      const row = id ? sourceById.get(id) : undefined;
      if (!row) throw new Error("A research fact has no source");
      return sourceRef(row);
    };
    const latest = periods[0];
    if (!latest) throw new Error("No sourced annual filing is available for research");
    const sic = facts.find(f => f.period_id === latest.id && f.line_item === "sec_sic_code");
    if (sic) {
      if (sic.is_demo) throw new Error("Synthetic SIC evidence refused");
      resolved(sic.source_id);
    }
    // Existing selection includes current analyst evidence, bounded carry-forward and SIC.
    // It performs only SELECTs and has no auth/network dependency.
    const activity = await activityEvidence(this.db as Parameters<typeof activityEvidence>[0],
      identity.company.id, latest, this.asOf.slice(0, 10));
    for (const segment of activity) {
      if (segment.is_demo) throw new Error("Synthetic activity evidence refused");
      if (segment.source_id && !sourceById.has(segment.source_id)) {
        const [s] = await this.db.select().from(source).where(eq(source.id, segment.source_id));
        if (s) sourceById.set(s.id, s);
      }
      resolved(segment.source_id);
    }
    const candidates = await this.db.select({ run: screeningRun, version: methodologyVersion, methodology })
      .from(screeningRun).innerJoin(methodologyVersion, eq(methodologyVersion.id, screeningRun.methodology_version_id))
      .innerJoin(methodology, eq(methodology.id, methodologyVersion.methodology_id))
      .where(and(eq(screeningRun.security_id, securityId), eq(methodology.production_enabled, true),
        eq(methodologyVersion.production_enabled, true)));
    // D-174: select latest per methodology before reading evidence; historical
    // superseded runs must not supply or taint today's packet.
    const selected = [...new Map([...candidates].sort((a, b) =>
      +a.run.generated_at - +b.run.generated_at).map(row => [row.methodology.id, row])).values()];
    const runs: PacketInput["runs"] = [];
    for (const entry of selected) {
      const { run, version, methodology: method } = entry;
      if (candidates.some(other => other.run.id !== run.id && other.methodology.id === method.id &&
        +other.run.generated_at === +run.generated_at)) throw new Error("Ambiguous latest research screening run");
      if (run.is_demo || version.is_demo || version.production_blocked || method.is_demo || method.production_blocked)
        throw new Error("Ineligible production screening evidence");
      const criteria = await this.db.select().from(screeningCriterionResult).where(eq(screeningCriterionResult.screening_run_id, run.id));
      const unknowns = await this.db.select().from(screeningUnknown).where(eq(screeningUnknown.screening_run_id, run.id));
      for (const criterion of criteria) {
        if (criterion.is_demo) throw new Error("Synthetic criterion evidence refused");
        for (const id of criterion.source_ids ?? []) {
          const [s] = await this.db.select().from(source).where(eq(source.id, id));
          if (!s) throw new Error("Criterion source unavailable");
          sourceRef(s);
        }
      }
      if (unknowns.some(u => u.is_demo)) throw new Error("Synthetic unknown evidence refused");
      if (!run.data_as_of || !run.engine_version || !run.calculation_version)
        throw new Error("Stored screening dates or versions are incomplete");
      runs.push({ methodology: method.slug, methodology_label: method.name,
        version: version.version_label ?? version.version, production_enabled: true,
        run_at: run.generated_at.toISOString(), date: run.data_as_of, data_as_of: run.data_as_of,
        status: run.status, engine_version: run.engine_version, calculation_version: run.calculation_version,
        immutable_hash: run.immutable_hash, confidence_tier: run.confidence === "High" ? "Verified" : "Estimated",
        source: { id: run.id, label: "Stored deterministic screening", url: method.source_url,
          accession: run.immutable_hash, is_synthetic: false, production_blocked: false },
        criteria: criteria.map(c => ({ id: c.criterion_id ?? c.id, result: c.result,
          ratio: c.ratio, threshold: c.threshold, numerator: c.numerator_value, denominator: c.denominator_value,
          unit: c.threshold_unit ?? "absolute", numerator_unit: latest.currency ?? "USD", denominator_unit: latest.currency ?? "USD" })),
        unknowns: unknowns.map(u => ({ id: u.id, explanation: u.why_missing ?? u.field_or_input })),
        reasons: runSchema.shape.reasons.parse(run.status_reasons.map(reason => ({
          kind: reason.kind, criterionId: reason.criterion_id, label: reason.criterion_label ?? "",
          field: reason.field ?? null, ratio: reason.ratio, threshold: reason.threshold,
          thresholdUnit: reason.threshold_unit ?? null, reasonCode: reason.reason_code,
          borderlineCount: reason.borderline_count, unknownCount: reason.unknown_count,
        }))),
      });
    }
    const priceRows = await this.db.select().from(priceBar).where(and(eq(priceBar.security_id, securityId),
      eq(priceBar.is_synthetic, false))).orderBy(desc(priceBar.month_end_for));
    const monthly = new Map<string, typeof priceBar.$inferSelect>();
    for (const row of priceRows) {
      if (!row.month_end_for) continue;
      const month = row.month_end_for.slice(0, 7);
      const existing = monthly.get(month);
      if (!existing || (row.price_provider === "manual" && existing.price_provider !== "manual")) monthly.set(month, row);
      else if (row.price_provider === existing.price_provider && row.close !== existing.close)
        throw new Error("Conflicting stored month-end closes");
    }
    const prices: PacketInput["prices"] = [];
    for (const [month, row] of monthly) {
      if (row.is_demo || row.close === null || !row.currency || !row.source_id) throw new Error("Incomplete stored price evidence");
      const [s] = await this.db.select().from(source).where(eq(source.id, row.source_id));
      if (!s) throw new Error("Price source unavailable");
      prices.push({ month_end_for: month, date: row.date, close: row.close, currency: row.currency,
        source: sourceRef(s), confidence_tier: s.confidence_tier });
    }
    return { security: { id: identity.security.id, ticker: identity.security.ticker, name: identity.company.name,
      sic: sic?.value === null || sic?.value === undefined ? null : String(sic.value),
      activity: activity.length ? [...new Set(activity.map(s => s.activity_category))].sort().join(", ") : null,
      covered: !coverage, in_universe: identity.security.in_universe,
      date: latest.reported_date!, source: resolved(latest.source_id), confidence_tier: sourceById.get(latest.source_id!)!.confidence_tier },
      periods: periods.map(p => ({ id: p.id, annual: true, period_end: p.period_end!, reported_date: p.reported_date!,
        facts: facts.filter(f => f.period_id === p.id && (FINANCIAL_FIELDS as readonly string[]).includes(f.line_item)).map(f => {
          if (f.is_demo) throw new Error("Synthetic financial evidence refused");
          const usable = !["unknown", "missing"].includes(f.input_state) && f.unit_scale === "absolute";
          return { field: f.line_item, value: usable ? f.value : null, unit: f.currency ?? p.currency ?? "unavailable",
            date: f.as_of_date ?? p.period_end!, source: resolved(f.source_id), confidence_tier: f.confidence_tier,
            unavailable_reason: f.unknown_note ?? "No usable stored value" };
        }) })),
      runs, prices, filings: await latestResearchFilings(this.db, securityId, this.asOf.slice(0, 10)) };
  }
}
export async function loadResearchPacket(securityId: string, now: string, loader: ResearchPacketLoader = new StoredResearchPacketLoader(dbApp, now)) {
  return buildResearchPacket(await loader.loadRows(securityId), now);
}
