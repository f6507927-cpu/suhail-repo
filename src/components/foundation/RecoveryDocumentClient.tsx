"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { BrandMark } from "./BrandMark";
import { RecoveryScreen } from "./RecoveryScreen";
import { publicUiCopy } from "@/i18n/presentation";
import { reviewText, type Locale } from "@/components/accounts/types";

const subscribe = () => () => {};
const getLocale = (): Locale => /^\/en(?:\/|$)/.test(window.location.pathname) ? "en" : "ar";
const serverLocale = () => "ar" as const;

export function RecoveryDocumentClient({ kind }: { kind: "error" | "not-found" }) {
  const locale = useSyncExternalStore(subscribe, getLocale, serverLocale);
  const pageTitle = kind === "not-found"
    ? (locale === "ar" ? publicUiCopy["Page not found"] : "Page not found")
    : reviewText(locale, "This page could not be loaded.");
  const documentTitle = `${pageTitle} | Suhail`;
  const fontVariables = {
    "--font-arabic": '"Noto Sans Arabic", system-ui, sans-serif',
    "--font-latin": "system-ui, sans-serif",
    "--font-numbers": "ui-monospace, SFMono-Regular, monospace",
  } as CSSProperties;

  return <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="dark" style={fontVariables} suppressHydrationWarning>
    {/* The global recovery document owns its App Router root. */}
    {/* eslint-disable-next-line @next/next/no-head-element */}
    <head>
      <title>{documentTitle}</title>
      <script id="suhail-theme-restore" src="/theme-restore.js" async blocking="render" />
    </head>
    <body>
      <div className="min-h-[100dvh] bg-background text-foreground">
        <header className="surface-dark border-b border-[var(--divider)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-4">
            {/* Raw anchors keep recovery navigation available without JavaScript. */}
            <a href={locale === "en" ? "/en" : "/"} aria-label={reviewText(locale, "Suhail · Public research")}>
              <span className="inline-flex items-center gap-3">
                <BrandMark surface="dark" className="size-7 shrink-0" />
                <span className="flex flex-col">
                  <span className="inline-flex items-baseline gap-2 leading-none">
                    <span lang="ar" className="text-2xl font-semibold text-brass-soft">سهيل</span>
                    <span lang="en" className="text-xl font-semibold">Suhail</span>
                  </span>
                  <span lang="ar" className="mt-1 text-xs font-normal leading-[1.9]">سهيل · استثمار متوافق</span>
                </span>
              </span>
            </a>
            <nav aria-label={reviewText(locale, "Interface language")} className="flex flex-wrap items-center gap-5 text-sm">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" lang="ar" dir="rtl" className="min-h-11 underline underline-offset-4">سهيل</a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/en" lang="en" dir="ltr" className="min-h-11 underline underline-offset-4">Suhail</a>
            </nav>
          </div>
        </header>
        <RecoveryScreen locale={locale} kind={kind} showHome={false} />
        <footer className="mx-auto max-w-6xl border-t border-[var(--divider)] px-6 py-7 text-sm text-muted-foreground">
          {reviewText(locale, "Suhail · Public research")}
        </footer>
      </div>
    </body>
  </html>;
}
