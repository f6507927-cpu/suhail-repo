import type { Metadata } from "next";
import ar from "../i18n/messages/ar.json";
import en from "../i18n/messages/en.json";
import type { PublicStockData } from "./types";
import { stripPublicReviewMarker } from "../components/foundation/shared";
import { englishCompanyName } from "../lib/format";
import { publicMethodologyVersionLabel } from "../i18n/methodology-labels";

export function stockMetadata(data: PublicStockData, locale: "ar" | "en", siteUrl: string): Metadata {
  const origin = new URL(siteUrl);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password) throw new Error("SITE_URL must be an HTTP(S) URL without credentials");
  const path = `/stock/${encodeURIComponent(data.security.slug!)}`;
  const url = (path: string) => new URL(path, origin).href;
  const messages = locale === "ar" ? ar : en;
  const englishName = englishCompanyName(data.company);
  const company = locale === "ar" ? data.company.name_ar?.trim() || englishName : englishName;
  const status = data.run ? messages.status[data.run.status] : locale === "ar" ? "⟦AR-REVIEW⟧ No run yet" : "No run yet";
  const version = publicMethodologyVersionLabel(data.version?.version_label || data.version?.version || data.run?.methodology_version_label);
  // D-150 applies to public document/social text too, including the no-run title.
  const title = stripPublicReviewMarker(`${company} (${data.security.ticker}) — ${status}${version ? ` · ${version}` : ""} | ${locale === "ar" ? "سهيل" : "Suhail"}`);
  const description = stripPublicReviewMarker([status, data.methodology?.name, version, data.run?.data_as_of].filter(Boolean).join(" · "));
  const canonical = url(locale === "ar" ? path : `/en${path}`);
  return {
    title: { absolute: title }, description,
    alternates: { canonical, languages: { ar: url(path), en: url(`/en${path}`), "x-default": url(path) } },
    robots: data.version?.production_enabled ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", title, description, url: canonical, siteName: "Suhail | سهيل", locale: locale === "ar" ? "ar" : "en_US", alternateLocale: [locale === "ar" ? "en_US" : "ar"], images: [{ url: url("/icons/icon-512.png"), alt: stripPublicReviewMarker(`${company} (${data.security.ticker}) — ${status}`) }] },
    twitter: { card: "summary", title, description, images: [url("/icons/icon-512.png")] },
  };
}
