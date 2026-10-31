/** SEC companyfacts observations retain their original filing metadata. */
export interface Observation {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number;
  fp?: string;
  form: string;
  filed: string;
  frame?: string;
  /** Explicit cover-page evidence only; absence is not evidence of plurality. */
  dimensions?: Record<string, string>;
  share_class?: string;
  member?: string;
  explicitly_aggregated?: boolean;
}
export interface Concept {
  label?: string;
  description?: string;
  units: Record<string, Observation[]>;
}
export interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, Concept>>;
}
export interface Retrieval {
  url: string;
  retrieved_at: string;
  is_synthetic: boolean;
  is_demo: boolean;
}
export interface Fixture {
  metadata: Retrieval & {
    trimming?: string;
    original_sha256?: string;
  };
  companyfacts: CompanyFacts;
}
export interface FilingSource {
  label: string;
  source_type: "regulatory_filing";
  provider: "SEC EDGAR";
  document_title: string;
  document_reference: string;
  source_url: string;
  retrieved_at: string;
  reporting_period: string;
  confidence_tier: "Verified";
  is_synthetic: boolean;
  is_demo: boolean;
  production_blocked: boolean;
  filed: string;
}
export interface MappedFact {
  line_item: string;
  value: number | null;
  currency: string | null;
  unit: "USD" | "shares";
  unit_scale: "absolute";
  input_state: "reported" | "derived" | "estimated" | "unknown";
  confidence_tier: "Verified" | "Calculated" | "Estimated";
  as_of_date: string;
  mapping_note: string;
  unknown_note: string | null;
  source: FilingSource | null;
  calculation_version: string;
  shares_class_concern?: boolean;
}
