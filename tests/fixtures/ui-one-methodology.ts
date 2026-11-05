import type { PublicMethodologyGroup, PublicMethodologyPageData } from "../../src/db/methodology-public";
import { uiOneFixture } from "./ui-one-stock";

export function uiOneMethodologyFixture(): PublicMethodologyPageData {
  const stock = uiOneFixture();
  return {
    methodology: {
      id: "method", slug: "fixture", name: stock.methodology!.name, short_label: "Suhail independent research",
      scope: stock.methodology!.scope, publisher: "Suhail independent research", type: "equity_screening",
      verified_by: "Admin", verification_date: "2026-11-05", source_title: "Untranslated source identity",
      source_url: "https://example.test/source", official_or_inspired: "adapted", licensing_status: "public_document",
      production_enabled: false, is_demo: false, current_version_label: "Adapted research 1.0 — draft",
    },
    defaultVersion: "1.0",
    documents: [{
      version: { id: "version", version: "1.0", version_label: "Adapted research 1.0 — draft",
        workflow_status: "source_verified", effective_date: "2026-11-05",
        changelog: "Founder-authorized draft preparation only.", production_enabled: false, is_demo: false,
        is_public: true, created_at: new Date("2026-11-05"), purification_treatment: null },
      criteria: [{
        id: "criterion", methodology_id: "method", methodology_version_id: "version",
        criterion_type: "non_permissible_revenue", label: "Prohibited income / total revenue",
        definition: "Founder-authorized draft preparation only.", formula_text: null,
        explanation_ar: null, explanation_en: null,
        numerator_definition: "prohibited_income", denominator_definition: "total_revenue",
        numerator_line_items: ["prohibited_income"], denominator_line_items: ["total_revenue"],
        threshold: 5, threshold_unit: "percent_of_total_revenue", threshold_direction: "max",
        borderline_margin: null, treatment_rules: null, treatment_rule_data: null, edge_cases: null,
        required_inputs: ["prohibited_income", "total_revenue"], source_reference: "Untranslated source identity",
        effective_date: "2026-11-05", sort_order: 0,
      }],
    }],
  };
}

export function uiOneMethodologyGroups(): PublicMethodologyGroup[] {
  const fixture = uiOneMethodologyFixture();
  return [{ ...fixture.methodology, versions: fixture.documents.map(({ version }) => ({
    ...version, methodology_id: fixture.methodology.id,
  })) }];
}
