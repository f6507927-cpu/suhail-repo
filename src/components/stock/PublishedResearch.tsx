import type { PublicStockData } from "@/stock/types";
import { Bilingual, Copy } from "./StockVerdictParts";
import styles from "./StockVerdict.module.css";
import { stripPublicReviewMarker } from "../foundation/shared";

/** Only the public-role, published-edition projection can reach this component. */
export function PublishedResearch({ pick, locale }: { pick: NonNullable<PublicStockData["publishedPick"]>; locale: "ar" | "en" }) {
  const paragraphs = [
    [pick.thesis_ar, pick.thesis_en],
    [pick.why_now_ar, pick.why_now_en],
    [pick.valuation_ar, pick.valuation_en],
    [pick.disclosure_ar, pick.disclosure_en],
  ];
  const risks = locale === "ar" ? pick.risks_ar ?? pick.risks_en : pick.risks_en ?? pick.risks_ar;
  return <section id="stock-published-research" className={styles.section} aria-labelledby="stock-research-title">
    <h2 id="stock-research-title"><Copy locale={locale}>Read the research</Copy></h2>
    <p><bdi>{stripPublicReviewMarker(pick.edition_label)}</bdi></p>
    {paragraphs.map(([ar, en], index) => ar?.trim() || en?.trim()
      ? <p key={index}><Bilingual locale={locale} arabic={ar} english={en} /></p> : null)}
    {risks?.length ? <ul>{risks.map((risk, index) => <li key={index}><bdi dir="auto">{stripPublicReviewMarker(risk)}</bdi></li>)}</ul> : null}
    {pick.disclaimer && <p><Bilingual locale={locale} arabic={null} english={pick.disclaimer} /></p>}
  </section>;
}
