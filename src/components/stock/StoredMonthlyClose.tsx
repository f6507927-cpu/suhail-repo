import type { StoredClose } from "../../ingest/prices/selection";
import { formatMoney } from "../../lib/format";
import { Num } from "../foundation/Num";
import { PublicLocalizedText, stripPublicReviewMarker } from "../foundation/shared";
import ar from "@/i18n/messages/ar.json";
import en from "@/i18n/messages/en.json";
import { ApiNinjasAttribution } from "./ApiNinjasAttribution";
import { uiOneDisplay } from "@/i18n/approved-arabic-ui-one";
import { StockDate } from "./StockDate";

/** D-153: stored evidence only; deliberately no fetch, clock or quote UI. */
export function StoredMonthlyClose({ close, locale, className = "", sourceUrl }: {
  close?: StoredClose | null; locale: "ar" | "en"; className?: string; sourceUrl?: string | null;
}) {
  if (!close || close.close === null) return null;
  const storedClosingOn = locale === "ar" ? ar.storedClose.closingOn : en.storedClose.closingOn;
  const closingOn = uiOneDisplay(stripPublicReviewMarker(storedClosingOn), locale);
  const candidateUrl = sourceUrl || close.source_url;
  const safeSource = candidateUrl && /^https?:\/\//i.test(candidateUrl) ? candidateUrl : null;
  return <p className={className} data-stored-close>
    <Num>{formatMoney(close.close, "en", "USD", 1)}</Num>{" · "}
    <PublicLocalizedText>{closingOn}</PublicLocalizedText>{" "}
    <StockDate value={close.date} locale={locale} />{" · "}
    {close.price_provider === "API Ninjas"
      ? <ApiNinjasAttribution locale={locale} />
      : safeSource
        ? <a href={safeSource} rel="noopener noreferrer"><bdi><PublicLocalizedText>{close.source_label}</PublicLocalizedText></bdi></a>
        : <bdi><PublicLocalizedText>{close.source_label}</PublicLocalizedText></bdi>}
  </p>;
}
