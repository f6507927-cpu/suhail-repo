import "server-only";
import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { dbPublic } from "./public";
import {
  methodology,
  methodologyCriterion,
  methodologyVersion,
} from "./schema";

// Public queries deliberately enumerate only columns granted to suhail_public
// in drizzle/0001_security.sql. Never use SELECT * here.
const publicMethodologyFields = {
  id: methodology.id,
  is_demo: methodology.is_demo,
  name: methodology.name,
  slug: methodology.slug,
  short_label: methodology.short_label,
  type: methodology.type,
  publisher: methodology.publisher,
  source_title: methodology.source_title,
  source_url: methodology.source_url,
  official_or_inspired: methodology.official_or_inspired,
  licensing_status: methodology.licensing_status,
  verified_by: methodology.verified_by,
  verification_date: methodology.verification_date,
  production_enabled: methodology.production_enabled,
  scope: methodology.scope,
  current_version_label: methodology.current_version_label,
};

const publicVersionFields = {
  id: methodologyVersion.id,
  is_demo: methodologyVersion.is_demo,
  version: methodologyVersion.version,
  version_label: methodologyVersion.version_label,
  effective_date: methodologyVersion.effective_date,
  changelog: methodologyVersion.changelog,
  production_enabled: methodologyVersion.production_enabled,
  workflow_status: methodologyVersion.workflow_status,
  purification_treatment: methodologyVersion.purification_treatment,
  created_at: methodologyVersion.created_at,
  is_public: methodologyVersion.is_public,
};

const publicCriterionFields = {
  id: methodologyCriterion.id,
  methodology_id: methodologyCriterion.methodology_id,
  methodology_version_id: methodologyCriterion.methodology_version_id,
  criterion_type: methodologyCriterion.criterion_type,
  label: methodologyCriterion.label,
  definition: methodologyCriterion.definition,
  formula_text: methodologyCriterion.formula_text,
  numerator_definition: methodologyCriterion.numerator_definition,
  denominator_definition: methodologyCriterion.denominator_definition,
  numerator_line_items: methodologyCriterion.numerator_line_items,
  denominator_line_items: methodologyCriterion.denominator_line_items,
  threshold: methodologyCriterion.threshold,
  threshold_unit: methodologyCriterion.threshold_unit,
  threshold_direction: methodologyCriterion.threshold_direction,
  borderline_margin: methodologyCriterion.borderline_margin,
  treatment_rules: methodologyCriterion.treatment_rules,
  treatment_rule_data: methodologyCriterion.treatment_rule_data,
  edge_cases: methodologyCriterion.edge_cases,
  required_inputs: methodologyCriterion.required_inputs,
  source_reference: methodologyCriterion.source_reference,
  effective_date: methodologyCriterion.effective_date,
  sort_order: methodologyCriterion.sort_order,
};

export async function getPublicMethodologies() {
  const parents = await dbPublic
    .select(publicMethodologyFields)
    .from(methodology)
    .where(
      exists(
        dbPublic
          .select({ id: methodologyVersion.id })
          .from(methodologyVersion)
          .where(
            and(
              eq(methodologyVersion.methodology_id, methodology.id),
              eq(methodologyVersion.is_public, true),
            ),
          ),
      ),
    )
    .orderBy(methodology.name);

  if (parents.length === 0) return [];
  const ids = parents.map((row) => row.id);
  const versions = await dbPublic
    .select({
      methodology_id: methodologyVersion.methodology_id,
      version: methodologyVersion.version,
      version_label: methodologyVersion.version_label,
      effective_date: methodologyVersion.effective_date,
      production_enabled: methodologyVersion.production_enabled,
      workflow_status: methodologyVersion.workflow_status,
      is_demo: methodologyVersion.is_demo,
    })
    .from(methodologyVersion)
    .where(
      and(
        inArray(methodologyVersion.methodology_id, ids),
        eq(methodologyVersion.is_public, true),
      ),
    )
    .orderBy(sql`${methodologyVersion.effective_date} desc nulls last`, desc(methodologyVersion.created_at));

  return parents.map((parent) => ({
    ...parent,
    versions: versions.filter((version) => version.methodology_id === parent.id),
  }));
}

export async function getPublicMethodology(
  slug: string,
) {
  const [parent] = await dbPublic
    .select(publicMethodologyFields)
    .from(methodology)
    .where(eq(methodology.slug, slug))
    .limit(1);
  if (!parent) return null;

  const versions = await dbPublic
    .select(publicVersionFields)
    .from(methodologyVersion)
    .where(
      and(
        eq(methodologyVersion.methodology_id, parent.id),
        eq(methodologyVersion.is_public, true),
      ),
    )
    .orderBy(sql`${methodologyVersion.effective_date} desc nulls last`, desc(methodologyVersion.created_at));
  const latestVersion = versions[0];
  if (!latestVersion) return null;

  // Documentation prefers a public production version independently of the
  // site's screening default. Both choices are already ordered latest-first.
  const defaultVersion = versions.find((version) => version.production_enabled) ?? latestVersion;

  const allCriteria = await dbPublic
    .select(publicCriterionFields)
    .from(methodologyCriterion)
    .where(inArray(methodologyCriterion.methodology_version_id, versions.map((version) => version.id)))
    .orderBy(methodologyCriterion.sort_order, methodologyCriterion.label);

  const documents = versions.map((version) => ({
    version,
    criteria: allCriteria.filter((criterion) => criterion.methodology_version_id === version.id),
  }));

  return {
    methodology: parent,
    documents,
    defaultVersion: defaultVersion.version,
  };
}

export type PublicMethodologyGroup = Awaited<
  ReturnType<typeof getPublicMethodologies>
>[number];
export type PublicMethodologyPageData = NonNullable<
  Awaited<ReturnType<typeof getPublicMethodology>>
>;
