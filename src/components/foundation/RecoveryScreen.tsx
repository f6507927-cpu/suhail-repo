"use client";

import { localePath } from "@/lib/auth/paths";
import { reviewText, type Locale } from "@/components/accounts/types";
import { publicUiCopy } from "@/i18n/presentation";
import { useLocale } from "next-intl";

export function RecoveryScreen({ locale, kind, retry, showHome = true }: {
  locale: Locale; kind: "error" | "not-found"; retry?: () => void; showHome?: boolean;
}) {
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-[50vh] max-w-2xl px-6 py-16">
    <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">404</p>
    <h1 className="mt-3 text-3xl font-semibold">{kind === "not-found" ? locale === "ar" ? publicUiCopy["Page not found"] : "Page not found" : reviewText(locale, "This page could not be loaded.")}</h1>
    <div className="mt-6 flex flex-wrap gap-6">
      {showHome && <a href={localePath(locale, "/")} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">{reviewText(locale, "Suhail · Public research")}</a>}
      {retry && <button onClick={retry} className="min-h-11 underline underline-offset-4">{reviewText(locale, "Retry")}</button>}
    </div>
  </main>;
}

export function LocalizedRecovery({ kind, retry }: { kind: "error" | "not-found"; retry?: () => void }) {
  const locale = useLocale() === "en" ? "en" : "ar";
  return <RecoveryScreen locale={locale} kind={kind} retry={retry} />;
}
