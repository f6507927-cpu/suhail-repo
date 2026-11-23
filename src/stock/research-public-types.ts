import type { Bilingual } from "../ai/research/contracts";
import type { PacketChange } from "../ai/research/changes";
import type { StaleReason } from "../ai/research/staleness";

export const WITHDRAWAL_REASONS = ["evidence_corrected", "no_longer_current", "editorial_withdrawal"] as const;
export type PublicationKind = "published" | "updated" | "withdrawn";
export type PublicResearchDisplay = {
  plain_summary: Bilingual[];
  analyst_view: {
    thesis: Bilingual[];
    evidence: Bilingual[];
    risks: Bilingual[];
    valuation: Bilingual;
  } | null;
  methodologies: { slug: string; label: string; status: string }[];
  citations: { source_id: string; label: string }[];
};
export type PublicStockResearch = PublicResearchDisplay & {
  name_ar: string;
  name_en: string | null;
  title_ar: string | null;
  title_en: string | null;
  credentials: string | null;
  headshot_object_key: string | null;
  bio_ar: string | null;
  bio_en: string | null;
  approval_at: string;
  data_as_of: string;
  update_codes: PacketChange["trigger"][];
  updated_at: string | null;
  outdated_codes: StaleReason[];
  outdated_at: string | null;
};
