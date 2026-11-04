import type { PublicStockData } from "../stock/types";

export type HomeEditorPick = {
  slug: string; ticker: string; company_name: string; company_name_ar: string | null;
  thesis_ar: string | null; thesis_en: string | null; published_at: string | null;
  analyst: {
    name_ar: string; name_en: string | null; credentials: string | null; portrait_url: string | null;
  } | null;
};
export type PublicHomeData = {
  featured: PublicStockData | null;
  methodology: { name: string; slug: string; version: string } | null;
  editorPick: HomeEditorPick | null;
};
