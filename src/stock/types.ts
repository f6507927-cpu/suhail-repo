import type * as market from "../db/schema/market";
import type * as screening from "../db/schema/screening";
import type * as methodology from "../db/schema/methodology";
import type { analystProfile } from "../db/schema/accounts";

export type StockSecurity = Pick<typeof market.security.$inferSelect, "id" | "slug" | "ticker" | "display_symbol" | "is_demo" | "company_id" | "exchange_id" | "coverage_analyst_id">;
export type StockCompany = Pick<typeof market.company.$inferSelect, "id" | "name" | "name_ar" | "description_ar" | "description_en" | "sector_label" | "is_demo">;
export type StockRun = Pick<typeof screening.screeningRun.$inferSelect, "id" | "status" | "status_reasons" | "confidence" | "data_adequacy" | "data_as_of" | "generated_at" | "immutable_hash" | "calculation_version" | "engine_version" | "financial_period_id" | "financial_period_label" | "is_demo" | "methodology_name" | "methodology_version_label">;
export type StockCriterion = Omit<typeof screening.screeningCriterionResult.$inferSelect, "created_by" | "created_at" | "updated_at" | "is_demo">;
export type StockUnknown = Omit<typeof screening.screeningUnknown.$inferSelect, "created_by" | "created_at" | "updated_at" | "is_demo">;
export type StockFact = Pick<typeof market.financialFact.$inferSelect, "id" | "line_item" | "label" | "value" | "value_text" | "currency" | "unit_scale" | "input_state" | "confidence_tier" | "source_id" | "unknown_note">;
export type StockSource = Pick<typeof market.source.$inferSelect, "id" | "label" | "source_type" | "document_title" | "document_reference" | "source_url" | "reporting_period">;
export type StockAnalyst = Pick<typeof analystProfile.$inferSelect, "name_ar" | "name_en" | "title_ar" | "title_en" | "credentials" | "bio_ar" | "bio_en" | "headshot_object_key">;
export type StockVersion = Pick<typeof methodology.methodologyVersion.$inferSelect, "id" | "version" | "version_label" | "production_enabled" | "is_demo">;
export type StockMethodology = Pick<typeof methodology.methodology.$inferSelect, "name" | "slug" | "scope" | "official_or_inspired" | "is_demo">;
export type StockExplanation = Pick<typeof screening.explanationObject.$inferSelect, "id" | "ai_text" | "validation_status" | "evidence" | "unknowns">;
export type PublicStockData = {
  security: StockSecurity; company: StockCompany;
  exchange: { code: string; name: string } | null;
  methodology: StockMethodology | null; version: StockVersion | null;
  run: StockRun | null; criteria: StockCriterion[]; unknowns: StockUnknown[];
  explanation: StockExplanation | null; priorRuns: StockRun[];
  period: { id: string; fiscal_period_label: string; period_end: string | null; reported_date: string | null; source_id: string | null } | null;
  facts: StockFact[]; sources: StockSource[]; analyst: StockAnalyst | null;
};
