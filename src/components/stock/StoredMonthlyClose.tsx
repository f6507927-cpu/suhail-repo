import type { StoredClose } from "../../ingest/prices/selection";
import { formatCalendarDate, formatMoney } from "../../lib/format";
import { Num } from "../foundation/Num";
import { PublicLocalizedText } from "../foundation/shared";
import en from "../../i18n/messages/en.json";
import ar from "../../i18n/messages/ar.json";
import { ApiNinjasAttribution } from "./ApiNinjasAttribution";

/** D-153: stored evidence only; deliberately no fetch, clock or quote UI. */
export function StoredMonthlyClose({ close, locale }: { close?: StoredClose | null; locale: "ar" | "en" }) {
  if (!close || close.close === null) return null;
  const closingOn = locale === "ar" ? ar.storedClose.closingOn : en.storedClose.closingOn;
  return <p>
    <Num>{formatMoney(close.close, locale, "USD", 1)}</Num>{" · "}
    <PublicLocalizedText>{closingOn}</PublicLocalizedText>{" "}
    <time dateTime={close.date}><bdi>{formatCalendarDate(close.date, locale, {
      day: "numeric", month: "short", year: "numeric",
    })}</bdi></time>{" · "}
    {close.price_provider === "API Ninjas"
      ? <ApiNinjasAttribution />
      : <bdi><PublicLocalizedText>{close.source_label}</PublicLocalizedText></bdi>}
  </p>;
}
