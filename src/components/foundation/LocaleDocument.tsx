import "server-only";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "../../i18n/routing";
import { DISPLAY_TIME_ZONE } from "../../lib/format";
import "../../app/globals.css";
import { THEME_COLORS } from "../../lib/theme-script";
import { ThemeColor } from "./ThemeColor";
const arabic = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-arabic-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-arabic-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-arabic",
  display: "swap",
});
const latin = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/ibm-plex-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-latin",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-numbers",
  display: "swap",
});
export const documentMetadata: Metadata = {
  title: "سهيل · Suhail", description: "دليلك في السوق.", manifest: "/manifest.webmanifest",
  icons: {icon:[{url:"/icons/favicon.ico",sizes:"16x16 32x32"}],apple:[{url:"/icons/icon-180.png",sizes:"180x180",type:"image/png"}]},
};
// D-22/D-51: reusable document never reads headers/cookies. Only private caller supplies nonce.
export async function LocaleDocument({children,locale,nonce}: {children: React.ReactNode;locale:string;nonce?:string}) {
  if (!hasLocale(routing.locales,locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages({locale});
  return <html lang={locale} dir={locale==="ar"?"rtl":"ltr"} className={`dark ${arabic.variable} ${latin.variable} ${mono.variable}`} suppressHydrationWarning>
    {/* App Router root document owns this head; next/head is for the Pages Router. */}
    {/* eslint-disable-next-line @next/next/no-head-element */}
    <head>
      <meta name="theme-color" content={THEME_COLORS.dark} suppressHydrationWarning />
      {/* D-22: React's async external-script resource is hoisted/deduplicated by
          the installed App Router renderer. blocking=render applies the choice
          before paint even when the Next bootstrap is slow; beforeInteractive
          queues inline code until bootstrap and is only a pre-hydration guarantee.
          Unlike an inline raw script, this resource also executes on client insertion. */}
      <script id="suhail-theme-restore" src="/theme-restore.js" async blocking="render" nonce={nonce} />
    </head>
    <body><ThemeColor /><NextIntlClientProvider locale={locale} messages={messages} timeZone={DISPLAY_TIME_ZONE}>{children}</NextIntlClientProvider></body>
  </html>;
}
