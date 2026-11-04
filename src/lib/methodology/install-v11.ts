import "server-only";
import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { methodology, methodologyVersion, methodologyCriterion } from "../../db/schema/methodology";
import { users } from "../../db/schema/accounts";
import { source } from "../../db/schema/market";
import type { Tx } from "../auth/audit";
import { requireLaunchActor } from "../launch/draft";
import { proposedV11Definition } from "./proposed-v1.1";
import { analystCasesSchema, criterionSchema, versionSchema } from "./contracts";
import { associateSource, saveVersion, saveCriterion, saveCases } from "./service";
import { missingV11Cases, v11Cases } from "./v11-cases";

export class V11InstallError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new V11InstallError(message);
}
function matches(actual: object, expected: object) {
  return Object.entries(expected).every(([key, value]) =>
    isDeepStrictEqual((actual as Record<string, unknown>)[key], value));
}
/** D-155: isolated installer, never launchPreflight (which can unpublish examples). */
export async function installV11(tx: Tx, email: string, dryRun: boolean) {
  if (dryRun) await tx.execute(sql`set transaction read only`);
  else await tx.execute(sql`select pg_advisory_xact_lock(66420020)`);
  const definition = proposedV11Definition();
  const expectedVersion = versionSchema.parse(definition.version);
  const expectedCriteria = definition.criteria.map(({ key: _key, ...value }) => {
    void _key; return criterionSchema.parse(value);
  });
  const actors = await tx.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
  check(actors.length === 1 && actors[0].role === "admin", "Expected exactly one existing admin actor");
  const actor = actors[0];
  const parents = await tx.select().from(methodology).where(eq(methodology.slug, definition.metadata.slug));
  check(parents.length === 1, "Expected existing Al Rajhi adapted methodology");
  const parent = parents[0];
  check(!parent.is_demo && !parent.production_blocked && parent.official_or_inspired === "adapted" &&
    parent.source_url === definition.metadata.source_url, "Methodology identity/source conflicts with v1.1 definition");
  const versions = await tx.select().from(methodologyVersion).where(eq(methodologyVersion.methodology_id, parent.id));
  const bases = versions.filter(v => v.version === "1.0");
  check(bases.length === 1 && !bases[0].is_demo && !bases[0].production_blocked, "Expected one genuine version 1.0");
  const documents = (await tx.select().from(source)).filter(s =>
    bases[0].source_ids.includes(s.id) && s.source_type === "methodology_document" &&
    s.source_url === parent.source_url && s.confidence_tier === "Verified" &&
    !s.is_demo && !s.is_synthetic && !s.production_blocked && !!s.document_title?.trim());
  check(documents.length === 1, "Version 1.0 must link exactly one eligible Verified methodology document");
  const baseCriteria = await tx.select().from(methodologyCriterion)
    .where(eq(methodologyCriterion.methodology_version_id, bases[0].id));
  const existing = versions.filter(v => v.version === "1.1");
  check(existing.length <= 1, "Ambiguous version 1.1");
  if (existing.length) {
    const version = existing[0], { is_public: _visibility, ...immutable } = expectedVersion;
    void _visibility;
    const rows = await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id, version.id));
    check(!version.is_demo && !version.production_blocked && matches(version, immutable) &&
      version.source_ids.includes(documents[0].id) && rows.length === expectedCriteria.length &&
      expectedCriteria.every(c => rows.filter(row => matches(row, c)).length === 1),
    "Existing version 1.1 conflicts or is incomplete; no changes made");
    const plan = missingV11Cases(analystCasesSchema.parse(version.analyst_test_cases),
      v11Cases(bases[0].analyst_test_cases, baseCriteria, rows));
    if (plan.added) {
      check(version.workflow_status === "draft", "Missing analyst cases can only be added while v1.1 is draft; no changes made");
      if (!dryRun) {
        await requireLaunchActor(tx, actor);
        await saveCases(tx, actor, version.id, plan.cases);
      }
    }
    return { dryRun, action: plan.added ? (dryRun ? "add missing cases" : "added missing cases") : "unchanged",
      versionId: version.id, sourceId: documents[0].id, casesAdded: plan.added, totalCases: plan.cases.length };
  }
  const plannedCriteria = expectedCriteria.map((c, i) => ({ ...c, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}` }));
  const plannedCases = v11Cases(bases[0].analyst_test_cases, baseCriteria, plannedCriteria);
  if (dryRun) return { dryRun: true, action: "create draft", version: "1.1",
    sourceId: documents[0].id, criteria: expectedCriteria.length,
    casesAdded: plannedCases.length,
    annualYieldAssumption: expectedCriteria.find(c => c.treatment_rule_data?.suhail_upper_bound)
      ?.treatment_rule_data?.suhail_upper_bound?.annual_yield_assumption,
    visibility: false, productionEnabled: false };
  await requireLaunchActor(tx, actor);
  const id = await saveVersion(tx, actor, parent.id, null, null, expectedVersion);
  const installedCriteria = [];
  for (const c of expectedCriteria) installedCriteria.push({ ...c, id: await saveCriterion(tx, actor, id, null, c) });
  await associateSource(tx, actor, id, documents[0].id);
  const cases = v11Cases(bases[0].analyst_test_cases, baseCriteria, installedCriteria);
  await saveCases(tx, actor, id, cases);
  return { dryRun: false, action: "created draft", versionId: id, sourceId: documents[0].id, casesAdded: cases.length };
}
