"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { PublicLocalizedText as LocalizedText } from "./shared";

export function StockSearchForm({ locale, query = "" }: {
  locale: "ar" | "en"; query?: string;
}) {
  const t = useTranslations("publicSearch");
  const id = "stock-query";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionStarted = useRef(false);

  useEffect(() => {
    const resetSubmission = () => {
      submissionStarted.current = false;
      setIsSubmitting(false);
    };

    window.addEventListener("pageshow", resetSubmission);
    return () => window.removeEventListener("pageshow", resetSubmission);
  }, []);

  return (
    <form
      action={locale === "en" ? "/en/search" : "/search"}
      method="get"
      role="search"
      aria-label={t("title")}
      onSubmit={(event) => {
        if (submissionStarted.current) {
          event.preventDefault();
          return;
        }
        submissionStarted.current = true;
        // Commit before native GET navigation can suspend the old document.
        flushSync(() => setIsSubmitting(true));
      }}
      className="flex max-w-xl flex-wrap items-end gap-2 rounded-full border border-[color-mix(in_srgb,var(--brass-soft)_55%,transparent)] bg-[var(--canopus)] p-1.5"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          <LocalizedText>{t("label")}</LocalizedText>
        </label>
        <input
          id={id}
          name="q"
          type="search"
          maxLength={40}
          defaultValue={query}
          placeholder={t("placeholder")}
          spellCheck={false}
          autoCapitalize="characters"
          enterKeyHint="search"
          dir="auto"
          className="min-h-[3.25rem] w-full rounded-full border-0 bg-transparent px-5 py-2 text-[1.05rem] text-[var(--night)] placeholder:text-[#5c6467] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex min-h-[3.25rem] shrink-0 items-center justify-center gap-2 rounded-full border border-[var(--brass)] bg-[var(--brass)] px-[1.6rem] py-2 text-base font-medium text-[var(--night)] transition-colors hover:bg-[var(--brass-soft)] disabled:cursor-wait disabled:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSubmitting && (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin"
            strokeWidth={1.6}
          />
        )}
        <LocalizedText>{t("screenSubmit")}</LocalizedText>
      </button>
    </form>
  );
}
