"use client";

import { localePath } from "@/lib/auth/paths";
import { reviewText, type Locale } from "@/components/accounts/types";
import { publicUiCopy } from "@/i18n/presentation";
import { useLocale } from "next-intl";
import { StockSearchForm } from "./StockSearchForm";
import enMessages from "@/i18n/messages/en.json";
import arMessages from "@/i18n/messages/ar.json";

export function RecoveryScreen({ locale, kind, retry, showHome = true, publicNotFound = false, nativeSearch = false }: {
  locale: Locale; kind: "error" | "not-found"; retry?: () => void; showHome?: boolean; publicNotFound?: boolean; nativeSearch?: boolean;
}) {
  const isPublicNotFound = publicNotFound && kind === "not-found";
  const searchCopy = {
    title: locale === "en" ? enMessages.publicSearch.title : arMessages.publicSearch.title,
    label: locale === "en" ? enMessages.publicSearch.label : arMessages.publicSearch.label,
    placeholder: locale === "en" ? enMessages.publicSearch.placeholder : arMessages.publicSearch.placeholder,
    screenSubmit: locale === "en" ? enMessages.publicSearch.screenSubmit : arMessages.publicSearch.screenSubmit,
  };
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="mx-auto min-h-[50vh] max-w-2xl px-6 py-16">
    <p className="font-mono text-xs tracking-[0.14em] text-muted-foreground">404</p>
    <h1 className="mt-3 text-3xl font-semibold">{kind === "not-found" ? locale === "ar" ? publicUiCopy["Page not found"] : "Page not found" : reviewText(locale, "This page could not be loaded.")}</h1>
    {isPublicNotFound && <>
      <p className="mt-4 text-muted-foreground">{reviewText(locale, "This page could not be loaded.")}</p>
      <div className="mt-7">
        {nativeSearch ? (
          <form
            action={locale === "en" ? "/en/search" : "/search"}
            method="get"
            role="search"
            aria-label={searchCopy.title}
            className="flex max-w-xl flex-wrap items-end gap-2 rounded-full border border-[color-mix(in_srgb,var(--brass-soft)_55%,transparent)] bg-[var(--canopus)] p-1.5"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="recovery-stock-query" className="sr-only">{searchCopy.label}</label>
              <input
                id="recovery-stock-query"
                name="q"
                type="search"
                maxLength={40}
                placeholder={searchCopy.placeholder}
                spellCheck={false}
                autoCapitalize="characters"
                 enterKeyHint="search"
                 dir="auto"
                className="min-h-[3.25rem] w-full rounded-full border-0 bg-transparent px-5 py-2 text-[1.05rem] text-[var(--night)] placeholder:text-[#5c6467] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[3.25rem] shrink-0 items-center justify-center rounded-full border border-[var(--brass)] bg-[var(--brass)] px-[1.6rem] py-2 text-base font-medium text-[var(--night)]"
            >
              {searchCopy.screenSubmit}
            </button>
          </form>
        ) : <StockSearchForm locale={locale} />}
      </div>
    </>}
    <div className="mt-6 flex flex-wrap gap-6">
      {showHome && <a href={localePath(locale, "/")} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">{isPublicNotFound ? locale === "en" ? enMessages.publicRecovery.backHome : arMessages.publicRecovery.backHome : reviewText(locale, "Suhail · Public research")}</a>}
      {retry && <button onClick={retry} className="min-h-11 underline underline-offset-4">{reviewText(locale, "Retry")}</button>}
    </div>
  </main>;
}

export function LocalizedRecovery({ kind, retry, publicNotFound = false, nativeSearch = false }: { kind: "error" | "not-found"; retry?: () => void; publicNotFound?: boolean; nativeSearch?: boolean }) {
  const locale = useLocale() === "en" ? "en" : "ar";
  return <RecoveryScreen locale={locale} kind={kind} retry={retry} publicNotFound={publicNotFound} nativeSearch={nativeSearch} />;
}
