import "server-only";
import { isDeepStrictEqual } from "node:util";
import { and, desc, eq, sql } from "drizzle-orm";
import { methodology, methodologyVersion, methodologyCriterion } from "../../db/schema/methodology";
import { users } from "../../db/schema/accounts";
import { source, security, financialPeriod, financialFact } from "../../db/schema/market";
import { audit, type Tx } from "../auth/audit";
import { requireLaunchActor } from "../launch/draft";
import { analystCasesSchema, engineCriterion } from "./contracts";
import { associateSource, saveCases, saveCriterion, saveMethodology, saveVersion, appendCases } from "./service";
import { canAppendAnalystCases, missingAnalystCases } from "./analyst-case-policy";
import { newMethodologyCases, newMethodologyDefinition, plannedIds, type NewMethodologyKey, type NewMethodologyDefinition } from "./new-methodologies";
import { testReport } from "./reports";
import { screen, ENGINE_VERSION, CALCULATION_VERSION } from "../../engine";
import type { Criterion, Fact } from "../../engine/types";
import { activityEvidence } from "../financial/activity-evidence";
import { securityFacts } from "../financial/market-value-persistence";
import { isBound, storedAssetInputs, storedBoundInputs, usesAssetKeys } from "../financial/screening-facts";

export class NewMethodologyInstallError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new NewMethodologyInstallError(message);
}
function matches(actual: object, expected: object) {
  return Object.entries(expected).every(([key, value]) =>
    isDeepStrictEqual((actual as Record<string, unknown>)[key], value));
}
/** Recorded on the source row; no source text or file is stored (copyrighted). */
export function documentReference(d: NewMethodologyDefinition["document"]) {
  return `Edition: ${d.edition}; SHA-256 of the retrieved PDF: ${d.sha256}; retrieved ${d.retrieved}. Link and hash only; no text or file stored (copyrighted).`;
}

/** Read-only: covered stocks whose MSCI status would change if operating leases
 * were added to total debt (D-172 reviewer evidence). Never writes. */
export async function operatingLeaseImpact(tx: Tx, definition: NewMethodologyDefinition, asOf: string) {
  const ids = plannedIds(definition);
  const criteria = definition.criteria.map(c => engineCriterion({ ...c.data, id: ids[c.key] }));
  const withLeases: Criterion[] = criteria.map(c => c.id === ids.debt
    ? { ...c, numeratorLineItems: [...c.numeratorLineItems, "operating_lease_liabilities"] } : c);
  const universe = await tx.select().from(security).where(eq(security.in_universe, true)).orderBy(security.id);
  const changed: { ticker: string; from: string; to: string }[] = [];
  let screened = 0, debtUnknown = 0;
  for (const s of universe) {
    if (!s.company_id || s.is_demo) continue;
    const [period] = await tx.select().from(financialPeriod).where(and(eq(financialPeriod.company_id, s.company_id),
      eq(financialPeriod.period_type, "annual"))).orderBy(sql`${financialPeriod.period_end} desc nulls last`,
      desc(financialPeriod.reported_date), financialPeriod.id).limit(1);
    if (!period?.period_end) continue;
    const rows = await tx.select().from(financialFact).where(and(eq(financialFact.company_id, s.company_id),
      eq(financialFact.period_id, period.id), eq(financialFact.is_current, true), securityFacts(s.id)));
    const segments = await activityEvidence(tx, s.company_id, period, asOf);
    const facts: Fact[] = [...rows.filter(f => !isBound(f.line_item)).map(f => ({ lineItem: f.line_item,
      value: f.input_state === "missing" ? null : f.value, inputState: f.input_state === "missing" ? "unknown" as const : f.input_state,
      confidenceTier: f.confidence_tier, sourceId: f.source_id ?? "" })),
    ...await storedBoundInputs(tx, rows, false), ...await storedAssetInputs(tx, rows, usesAssetKeys(criteria))];
    const input = { securityId: s.id, asOf, engineVersion: ENGINE_VERSION, calculationVersion: CALCULATION_VERSION,
      period: { id: period.id, label: period.fiscal_period_label, periodEnd: period.period_end }, facts,
      segments: segments.map(b => ({ segmentName: b.segment_name, activityCategory: b.activity_category,
        revenueAmount: b.revenue_amount, revenueShare: b.revenue_share,
        inputState: b.input_state === "missing" ? "unknown" as const : b.input_state,
        confidenceTier: b.confidence_tier, sourceId: b.source_id ?? "" })) };
    try {
      const base = screen({ ...input, methodologyVersion: { id: "msci-planned", label: "planned", criteria } });
      const alt = screen({ ...input, methodologyVersion: { id: "msci-planned", label: "planned", criteria: withLeases } });
      screened++;
      if (base.criteria.find(c => c.criterionId === ids.debt)?.result === "unknown") debtUnknown++;
      if (base.status !== alt.status) changed.push({ ticker: s.ticker, from: base.status, to: alt.status });
    } catch { continue; }
  }
  return { coveredStocksScreened: screened, statusChangesIfOperatingLeasesIncluded: changed.length,
    changes: changed, totalDebtUnknown: debtUnknown };
}

/** D-171/D-172: isolated, audited, idempotent draft installer. Never approves,
 * publishes, enables production or changes the editorial default. */
export async function installNewMethodology(tx: Tx, key: NewMethodologyKey, email: string, dryRun: boolean, today: string) {
  check(/^\d{4}-\d{2}-\d{2}$/.test(today), "Invalid run date");
  if (dryRun) await tx.execute(sql`set transaction read only`);
  else await tx.execute(sql`select pg_advisory_xact_lock(66420020)`);
  const definition = newMethodologyDefinition(key);
  const doc = definition.document;
  const actors = await tx.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
  check(actors.length === 1 && actors[0].role === "admin", "Expected exactly one existing admin actor");
  const actor = actors[0];
  // Verified only through this founder-run installer: the running admin verifies.
  const verification = { verified_by: actor.full_name, verification_date: today };

  const parents = await tx.select().from(methodology).where(eq(methodology.slug, definition.metadata.slug));
  check(parents.length <= 1, "Ambiguous methodology slug");
  const parent = parents[0];
  const { verified_by: _v, verification_date: _d, ...identity } = definition.metadata;
  void _v; void _d;
  if (parent) check(!parent.is_demo && !parent.production_blocked && !parent.production_enabled && matches(parent, identity),
    "Existing methodology conflicts with the committed definition; no changes made");

  const documents = await tx.select().from(source).where(and(eq(source.source_type, "methodology_document"),
    eq(source.source_url, doc.url), eq(source.document_title, doc.title)));
  check(documents.length <= 1, "Ambiguous methodology document; reconcile manually");
  const document = documents[0];
  if (document) check(!document.is_demo && !document.is_synthetic && !document.production_blocked &&
    document.confidence_tier === "Verified" && document.document_reference === documentReference(doc),
  "Existing methodology document is not the recorded verified edition; no overwrite");

  const versions = parent ? await tx.select().from(methodologyVersion).where(eq(methodologyVersion.methodology_id, parent.id)) : [];
  check(versions.length <= 1 && versions.every(v => v.version === definition.version.version),
    "Unexpected additional versions; reconcile manually");
  const version = versions[0];
  const { is_public: _p, ...immutableVersion } = definition.version;
  void _p;
  if (version) check(!version.is_demo && !version.production_blocked && !version.production_enabled &&
    matches(version, immutableVersion) && (!document || version.source_ids.every(id => id === document.id)),
  "Existing version conflicts with the committed definition; no changes made");
  const existing = version ? await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id, version.id)) : [];
  const ids: Record<string, string> = plannedIds(definition);
  for (const c of definition.criteria) {
    const found = existing.filter(r => r.sort_order === c.data.sort_order);
    check(found.length <= 1 && (!found.length || matches(found[0], c.data)), `Conflicting criterion ${c.key}; no overwrite`);
    if (found[0]) ids[c.key] = found[0].id;
  }
  check(existing.length === 0 || existing.length === definition.criteria.length, "Partially installed criteria; reconcile manually");
  const cases = newMethodologyCases(definition, ids);
  const report = testReport({ id: version?.id ?? "planned", label: definition.version.version_label ?? "1.0",
    criteria: definition.criteria.map(c => engineCriterion({ ...c.data, id: ids[c.key] })) }, cases);
  check(report.passed, "Analyst cases failed evaluation or coverage; no changes made");
  const casePlan = version ? missingAnalystCases(analystCasesSchema.parse(version.analyst_test_cases), cases) : { cases, added: cases.length };

  const record = {
    methodology: { ...definition.metadata, ...(parent?.verified_by ? { verified_by: parent.verified_by,
      verification_date: parent.verification_date } : verification), is_demo: false, production_enabled: false },
    version: { ...definition.version, workflow_status: "draft", production_enabled: false },
    sourceDocument: { label: doc.title, source_type: "methodology_document", provider: doc.provider,
      document_title: doc.title, source_url: doc.url, document_reference: documentReference(doc),
      retrieved_at: doc.retrieved, confidence_tier: "Verified", is_demo: false, is_synthetic: false, created_by: actor.email },
    criteria: definition.criteria.map(c => ({ key: c.key, label: c.data.label, type: c.data.criterion_type,
      numerator: c.data.numerator_line_items, denominator: c.data.denominator_line_items,
      threshold: c.data.threshold, direction: c.data.threshold_direction, atLimit: c.data.threshold_direction === "max" ? "pass" : null,
      locator: c.data.source_reference })),
    analystCases: { total: casePlan.cases.length, toAdd: casePlan.added, coveragePassed: report.passed },
    notApplied: definition.notApplied, reviewerQuestions: definition.reviewerQuestions,
    never: ["approve", "publish", "enable production", "change the editorial default", "store or serve source text or files"],
  };
  const leases = key === "msci" ? await operatingLeaseImpact(tx, definition, today) : undefined;
  const plan = {
    methodology: parent ? "unchanged" : "create non-demo, production-disabled",
    version: version ? "unchanged draft" : "create unpublished draft 1.0",
    criteria: existing.length ? "unchanged" : `create ${definition.criteria.length}`,
    sourceDocument: document ? "reuse verified document" : "create Verified document attributed to the actor",
    analystCases: casePlan.added ? `add ${casePlan.added}` : "unchanged",
  };
  if (dryRun) return { dryRun: true, actor: actor.email, plan, record, ...(leases ? { operatingLeaseImpact: leases } : {}) };

  if (version && casePlan.added) check(canAppendAnalystCases(version.workflow_status, version.production_enabled),
    "Missing analyst cases can only be added before tests_passed; no changes made");
  await requireLaunchActor(tx, actor);
  const parentId = parent?.id ?? await saveMethodology(tx, actor, null, { ...definition.metadata, ...verification });
  let documentId = document?.id;
  if (!documentId) {
    const [created] = await tx.insert(source).values({
      label: doc.title, source_type: "methodology_document", provider: doc.provider, document_title: doc.title,
      source_url: doc.url, document_reference: documentReference(doc), retrieved_at: new Date(`${doc.retrieved}T00:00:00Z`),
      confidence_tier: "Verified", is_demo: false, is_synthetic: false, production_blocked: false, created_by: actor.id,
    }).returning();
    documentId = created.id;
    await audit(tx, actor, { event_type: "methodology_update", entity_name: "source", entity_id: documentId,
      summary: "Verified methodology document recorded by founder-run installer",
      details: { decision: definition.decision, sha256: doc.sha256, edition: doc.edition, verifiedBy: actor.id, verificationDate: today } });
  }
  const versionId = version?.id ?? await saveVersion(tx, actor, parentId, null, null, definition.version);
  if (!existing.length) for (const c of definition.criteria) ids[c.key] = await saveCriterion(tx, actor, versionId, null, c.data);
  if (!version?.source_ids.includes(documentId)) await associateSource(tx, actor, versionId, documentId);
  const finalCases = newMethodologyCases(definition, ids);
  if (!version) await saveCases(tx, actor, versionId, finalCases);
  else if (casePlan.added) await appendCases(tx, actor, versionId, finalCases);
  return { dryRun: false, actor: actor.email, plan, methodologyId: parentId, versionId, sourceId: documentId,
    ...(leases ? { operatingLeaseImpact: leases } : {}) };
}
