import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import ar from "../i18n/messages/ar.json";
import en from "../i18n/messages/en.json";
import { englishCompanyName } from "../lib/format";
import { stripPublicReviewMarker } from "../components/foundation/shared";
import type { PublicStockData } from "./types";

/**
 * Link preview (Open Graph / Twitter) for a public stock page. It uses only the
 * public stock data already rendered on the page: company, ticker, exchange and
 * the stored status label. Display only; no status or number is derived here.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
type Locale = "ar" | "en";

// Fixed brand palette for a dark card (reference §4; status colours only for status).
const color = {
  night: "#0b2e33", deep: "#061e21", raise: "#164349", ink: "#e6efee", soft: "#b9cbca",
  brass: "#c08b3e", brassSoft: "#e0bc85", pass: "#3fab7c", alert: "#d9816e", muted: "#919a9d",
};
const statusStyle: Record<string, { bar: string; fill: string | null; text: string }> = {
  passes_selected_methodology: { bar: color.pass, fill: color.pass, text: color.night },
  fails_selected_methodology: { bar: color.alert, fill: color.alert, text: color.night },
  requires_review: { bar: color.alert, fill: null, text: color.alert },
  insufficient_data: { bar: color.muted, fill: null, text: color.muted },
};
const star = "data:image/svg+xml;base64," + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,2 55.358,37.066 69.799,30.201 62.934,44.642 98,50 62.934,55.358 69.799,69.799 55.358,62.934 50,98 44.642,62.934 30.201,69.799 37.066,55.358 2,50 37.066,44.642 30.201,30.201 44.642,37.066" fill="#C08B3E"/></svg>',
).toString("base64");

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 }[]> | null = null;
function loadFonts() {
  // `new URL(..., import.meta.url)` lets the bundler trace and ship these files.
  fonts ??= Promise.all([
    readFile(new URL("./og-fonts/ibm-plex-sans-arabic-arabic-400-normal.woff", import.meta.url)).then(data => ({ name: "PlexArabic", data, weight: 400 as const })),
    readFile(new URL("./og-fonts/ibm-plex-sans-arabic-arabic-600-normal.woff", import.meta.url)).then(data => ({ name: "PlexArabic", data, weight: 600 as const })),
    readFile(new URL("./og-fonts/ibm-plex-sans-arabic-latin-400-normal.woff", import.meta.url)).then(data => ({ name: "PlexLatin", data, weight: 400 as const })),
    readFile(new URL("./og-fonts/ibm-plex-sans-arabic-latin-600-normal.woff", import.meta.url)).then(data => ({ name: "PlexLatin", data, weight: 600 as const })),
  ]);
  return fonts;
}

const isArabic = (text: string) => /[\p{Script=Arabic}]/u.test(text);

/**
 * Satori shapes Arabic glyphs but lays words out left to right. Render each word
 * as its own box in an RTL (row-reverse) flex row so Arabic reads in order.
 */
function Words({ text, size, weight = 600, fill, rtl, wrap = false }: { text: string; size: number; weight?: 400 | 600; fill: string; rtl: boolean; wrap?: boolean }) {
  if (!rtl || !isArabic(text)) {
    return <div style={{ display: "flex", fontSize: size, fontWeight: weight, color: fill, lineHeight: 1.2 }}>{text}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", flexWrap: wrap ? "wrap" : "nowrap", justifyContent: "flex-start", gap: Math.round(size * 0.16), fontSize: size, fontWeight: weight, color: fill, lineHeight: 1.35 }}>
      {text.split(/\s+/).filter(Boolean).map((word, index) => (
        <span key={index} style={{ display: "flex", flexShrink: 0 }}>{word}</span>
      ))}
    </div>
  );
}

export async function stockOgImage(data: PublicStockData | null, locale: Locale) {
  const rtl = locale === "ar";
  const messages = locale === "ar" ? ar : en;
  const row = rtl ? "row-reverse" : "row";
  const align = rtl ? "flex-end" : "flex-start";
  let body: ReactNode;
  let bar: string = color.brass;

  if (data) {
    const english = englishCompanyName(data.company);
    const arabicName = data.company.name_ar?.trim();
    const name = stripPublicReviewMarker(rtl && arabicName ? arabicName : english);
    const ticker = (data.security.display_symbol || data.security.ticker).toUpperCase();
    const status = data.run ? statusStyle[data.run.status] : null;
    const label = data.run ? messages.status[data.run.status] : null;
    if (status) bar = status.bar;
    body = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 34 }}>
        <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 132, height: 132, borderRadius: 32, background: color.raise, color: color.brassSoft, fontSize: ticker.length > 4 ? 30 : ticker.length > 3 ? 36 : 44, fontWeight: 600, fontFamily: "PlexLatin" }}>
            {ticker.slice(0, 5)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 10, maxWidth: 860 }}>
            <Words text={name} size={name.length > 26 ? 52 : 64} fill={color.ink} rtl={rtl} wrap />
            <div style={{ display: "flex", flexDirection: row, gap: 14, fontSize: 30, color: color.soft, fontFamily: "PlexLatin" }}>
              <span>{ticker}</span>
              {data.exchange?.code ? <span>·</span> : null}
              {data.exchange?.code ? <span>{data.exchange.code}</span> : null}
            </div>
          </div>
        </div>
        {status && label ? (
          <div style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: "14px 34px", background: status.fill ?? "transparent", border: status.fill ? "none" : `4px solid ${status.text}` }}>
            <Words text={label} size={40} fill={status.text} rtl={rtl} />
          </div>
        ) : null}
      </div>
    );
  } else {
    body = <Words text={rtl ? "سهيل" : "Suhail"} size={72} fill={color.ink} rtl={rtl} />;
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: color.night, fontFamily: rtl ? "PlexArabic, PlexLatin" : "PlexLatin, PlexArabic" }}>
        <div style={{ display: "flex", width: "100%", height: 16, background: bar }} />
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between", padding: "56px 72px 52px" }}>
          {body}
          <div style={{ display: "flex", flexDirection: row, alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only. */}
            <img src={star} width={48} height={48} alt="" />
            <div style={{ display: "flex", fontSize: 44, fontWeight: 600, color: color.brassSoft, fontFamily: "PlexArabic" }}>سهيل</div>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 600, color: color.ink, fontFamily: "PlexLatin" }}>Suhail</div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
