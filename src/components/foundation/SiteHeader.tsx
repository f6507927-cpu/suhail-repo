"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Lockup } from "./Lockup";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { StockSearchForm } from "./StockSearchForm";
import { shouldShowHeaderSearch } from "./header-search";

export type SiteHeaderLocale = "ar" | "en";

type SiteHeaderProps = {
  locale: SiteHeaderLocale;
  labels: {
    appName: string;
    menu: string;
    picks: string;
    methodologies: string;
  };
  accountControl: ReactNode;
};

export function SiteHeader({ locale, labels, accountControl }: SiteHeaderProps) {
  const pathname = usePathname() ?? "";
  const homeHref = locale === "en" ? "/en" : "/";
  const methodologyHref = locale === "en" ? "/en/methodology" : "/methodology";
  const showSearch = shouldShowHeaderSearch(pathname);

  return (
    <header className="surface-dark border-b border-[var(--divider)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-5">
        <a href={homeHref} aria-label={labels.appName}>
          <Lockup surface="dark" />
        </a>
        <div className="flex flex-wrap items-center gap-6">
          <nav aria-label={labels.menu} className="flex gap-6 text-sm">
            <a href={methodologyHref} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {labels.methodologies}
            </a>
          </nav>
          {showSearch && <StockSearchForm locale={locale} compact />}
          {accountControl}
          <div className="flex items-center gap-3 border-s border-[var(--divider)] ps-5">
            <LocaleSwitcher className="text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
