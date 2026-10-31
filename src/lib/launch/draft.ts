import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { methodology, methodologyVersion, methodologyCriterion } from "../../db/schema/methodology";
import { editorialSetting } from "../../db/schema/editorial";
import { users } from "../../db/schema/accounts";
import { source } from "../../db/schema/market";
import { audit } from "../auth/audit";
import type { Tx, AppUser } from "../auth/audit";
import { associateSource, saveMethodology, saveVersion, saveCriterion, saveCases, setVisibility } from "../methodology/service";
import { engineCriterion } from "../methodology/contracts";
import { testReport } from "../methodology/reports";
import { launchCases, type LaunchDefinition } from "./contracts";

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  return Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every(k => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};
const documentProvider = "Al Rajhi Capital (public document)";
function assert(value: unknown, message: string): asserts value { if (!value) throw new LaunchPreflightError(message); }
export class LaunchPreflightError extends Error {}
function matches(row: object, fields: object) {
  const a = row as Record<string, unknown>;
  return Object.entries(fields).every(([key, value]) => same(a[key], value));
}
export async function launchPreflight(tx: Tx, email: string, definition: LaunchDefinition) {
  const documentUrl = definition.metadata.source_url;
  const documentTitle = definition.metadata.source_title;
  assert(documentUrl?.startsWith("https://") && documentTitle?.trim(),
    "Launch methodology needs an HTTPS document URL and title");
  assert(documentUrl && documentTitle, "Missing launch methodology document");
  const actors = await tx.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
  assert(actors.length === 1 && actors[0].role === "admin", "Expected exactly one existing admin actor; no role is granted");
  const actor = actors[0];
  const settings = await tx.select().from(editorialSetting);
  const examples: (typeof methodologyVersion.$inferSelect)[] = [];
  const plan: string[] = [];
  for (const letter of ["A", "B"]) {
    const found = await tx.select().from(methodology).where(sql`${methodology.slug} = ${`example-${letter.toLowerCase()}`} or ${methodology.name} = ${`Example Methodology ${letter}`}`);
    assert(found.length <= 1, `Ambiguous Example Methodology ${letter} identity`);
    if (!found.length) { plan.push(`Example Methodology ${letter}: absent, no change`); continue; }
    assert(found[0].is_demo && found[0].official_or_inspired === "internal_example", "Example identity conflicts with non-example content");
    const versions = await tx.select().from(methodologyVersion).where(eq(methodologyVersion.methodology_id, found[0].id));
    assert(!versions.some(v => settings.some(s => s.default_shariah_methodology_version_id === v.id)),
      `Example Methodology ${letter} is the editorial default; stop. Founder must select an eligible default separately.`);
    for (const v of versions) {
      plan.push(`${found[0].name} ${v.version}: ${v.is_public ? "unpublish through visibility service" : "already unpublished"}`);
      if (v.is_public) examples.push(v);
    }
  }
  const [parent] = await tx.select().from(methodology).where(eq(methodology.slug, definition.metadata.slug));
  // Human verification may already have been recorded in the admin workflow.
  // Preserve it; setup must neither invent it nor reject it solely for being filled.
  const expectedMetadata = { ...definition.metadata,
    verified_by: definition.metadata.verified_by ?? parent?.verified_by ?? null,
    verification_date: definition.metadata.verification_date ?? parent?.verification_date ?? null };
  if (parent) assert(!parent.is_demo && !parent.production_enabled && !parent.production_blocked && matches(parent, expectedMetadata),
    "Existing launch methodology conflicts with committed metadata; reconcile manually");
  const versions = parent ? await tx.select().from(methodologyVersion).where(eq(methodologyVersion.methodology_id, parent.id)) : [];
  assert(versions.length <= 1, "Unexpected additional launch versions; reconcile manually");
  const version = versions[0];
  const documents = await tx.select().from(source).where(and(
    eq(source.source_type, "methodology_document"),
    eq(source.source_url, documentUrl),
    eq(source.provider, documentProvider),
    eq(source.document_title, documentTitle)));
  assert(documents.length <= 1, "Ambiguous launch methodology document; reconcile manually");
  const document = documents[0];
  if (document) assert(!document.is_demo && !document.is_synthetic && !document.production_blocked &&
    document.confidence_tier === "Verified" && document.retrieved_at,
  "Existing launch methodology document is not genuine verified evidence; no overwrite");
  if (version) assert(version.workflow_status === "draft" && !version.is_demo && !version.is_public &&
    !version.production_enabled && !version.production_blocked && !version.approved_by && !version.approval_id &&
    version.source_ids.every(id => id === document?.id) && !version.workflow_history.length && matches(version, definition.version),
  "Existing launch version conflicts or has left draft; no overwrite");
  const existing = version ? await tx.select().from(methodologyCriterion).where(eq(methodologyCriterion.methodology_version_id, version.id)) : [];
  const identities: Record<string, string> = {};
  for (const [i, criterion] of definition.criteria.entries()) {
    const found = existing.filter(c => c.sort_order === criterion.data.sort_order);
    assert(found.length <= 1 && (!found.length || matches(found[0], criterion.data)), `Conflicting criterion ${criterion.key}; no overwrite`);
    identities[criterion.key] = found[0]?.id ?? `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    plan.push(`${criterion.key}: ${found.length ? "unchanged" : "create draft criterion"}`);
  }
  assert(existing.length === existing.filter(c => definition.criteria.some(d => d.data.sort_order === c.sort_order)).length, "Unexpected launch criteria; no deletion");
  const cases = launchCases(definition, identities);
  assert(!version?.analyst_test_cases.length || same(version.analyst_test_cases, cases), "Conflicting analyst cases; no overwrite");
  const report = testReport({ id: version?.id ?? "launch-draft", label: definition.version.version_label ?? "1.0",
    criteria: definition.criteria.map(c => engineCriterion({ ...c.data, id: identities[c.key] })) }, cases);
  assert(report.passed, "Launch analyst cases failed evaluation/coverage; no changes");
  plan.unshift(`Actor: ${actor.email} (${actor.id})`, `Methodology: ${parent ? "unchanged" : "create non-demo, production-disabled"}`,
    `Version 1.0: ${version ? "unchanged draft" : "create unpublished draft"}`);
  plan.push(`Analyst cases: ${version?.analyst_test_cases.length ? "unchanged" : "save candidate cases with persisted criterion IDs"}; coverage passed, no report/workflow advancement`,
    `Verified methodology document: ${document ? "reuse" : "create with actor-attributed audit"}; ${document && version?.source_ids.includes(document.id) ? "already associated" : "associate with draft through source gate"}`,
    "No workflow advancement, approval, production enablement, publication, default or SITE_MODE change");
  return { actor, examples, parent, version, existing, document, documentUrl, documentTitle, plan };
}
export async function prepareLaunchDraft(tx: Tx, email: string, definition: LaunchDefinition) {
  // Same lock as governed authoring; recheck all conflicts before the first write.
  await tx.execute(sql`select pg_advisory_xact_lock(66420020)`);
  const p = await launchPreflight(tx, email, definition);
  await requireLaunchActor(tx, p.actor);
  for (const v of p.examples) await setVisibility(tx, p.actor, v.id, false);
  const parentId = p.parent?.id ?? await saveMethodology(tx, p.actor, null, definition.metadata);
  const versionId = p.version?.id ?? await saveVersion(tx, p.actor, parentId, null, null, definition.version);
  let document = p.document;
  if (!document) {
    [document] = await tx.insert(source).values({
      label: p.documentTitle, source_type: "methodology_document",
      provider: documentProvider, document_title: p.documentTitle,
      source_url: p.documentUrl, confidence_tier: "Verified",
      is_demo: false, is_synthetic: false, production_blocked: false,
      retrieved_at: new Date(), created_by: p.actor.id,
    }).returning();
    await audit(tx, p.actor, { event_type: "methodology_update", entity_name: "source",
      entity_id: document.id, summary: "Verified launch methodology document created",
      details: { methodologyVersionId: versionId } });
  }
  if (!p.version?.source_ids.includes(document.id))
    await associateSource(tx, p.actor, versionId, document.id);
  const ids: Record<string, string> = {};
  for (const c of definition.criteria)
    ids[c.key] = p.existing.find(r => r.sort_order === c.data.sort_order)?.id ??
      await saveCriterion(tx, p.actor, versionId, null, c.data);
  if (!p.version?.analyst_test_cases.length) await saveCases(tx, p.actor, versionId, launchCases(definition, ids));
  return p.actor;
}
export async function requireLaunchActor(tx: Tx, actor: AppUser) {
  const [current] = await tx.select().from(users).where(and(eq(users.id, actor.id), eq(users.role, "admin"))).for("share");
  assert(current, "Launch actor is no longer an admin");
  return current;
}
