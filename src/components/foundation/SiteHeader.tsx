"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "../../i18n/navigation";
import { Lockup } from "./Lockup";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

export type SiteHeaderLocale = "ar" | "en";

type SiteHeaderProps = {
  locale: SiteHeaderLocale;
  labels: {
    appName: string;
    menu: string;
    screenStock: string;
    methodologies: string;
  };
  accountControl: ReactNode;
};

export const STOCK_QUERY_ID = "stock-query";

/** D-160: bring the homepage stock search into view and focus it. */
export function focusStockQuery(doc: Document = document): boolean {
  const input = doc.getElementById(STOCK_QUERY_ID);
  if (!(input instanceof HTMLElement)) return false;
  const reduce = doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? true;
  (input.closest("form") ?? input).scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  input.focus({ preventScroll: true });
  return true;
}

function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function SiteHeader({ locale, labels, accountControl }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const focusAfterNavigation = useRef(false);
  const wasPending = useRef(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  // next-intl pathname: locale prefix removed, so "/" is the homepage in both locales.
  const pathname = usePathname();
  const homeHref = locale === "en" ? "/en" : "/";
  const screenHref = `${homeHref}#${STOCK_QUERY_ID}`;
  const methodologyHref = locale === "en" ? "/en/methodology" : "/methodology";
  const navigating = isPending || pendingHref !== null;

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 760px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  // D-160: warm the two destinations as soon as the phone menu opens, so a
  // cold instance starts work before the tap rather than after it.
  useEffect(() => {
    if (!menuOpen) return;
    router.prefetch(homeHref);
    router.prefetch(methodologyHref);
  }, [menuOpen, router, homeHref, methodologyHref]);

  // The menu stays open, showing the pressed link, until the new page commits.
  useEffect(() => {
    if (isPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;
    setPendingHref(null);
    setMenuOpen(false);
    if (focusAfterNavigation.current) {
      focusAfterNavigation.current = false;
      focusStockQuery();
    }
  }, [isPending]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string, target: "home" | "stock" | "methodology") {
    if (!plainClick(event)) return;
    event.preventDefault();
    // A second tap while a navigation is in flight does nothing.
    if (navigating) return;
    if (target === "stock" && pathname === "/") {
      // Already on the homepage: no navigation, just scroll and focus.
      setMenuOpen(false);
      if (window.location.hash !== `#${STOCK_QUERY_ID}`)
        window.history.pushState(window.history.state, "", screenHref);
      focusStockQuery();
      return;
    }
    focusAfterNavigation.current = target === "stock";
    setPendingHref(href);
    startTransition(() => router.push(href, { scroll: target !== "stock" }));
  }

  function navLink(href: string, target: "home" | "stock" | "methodology", children: ReactNode, className?: string, label?: string) {
    const pending = pendingHref === href;
    return (
      <Link
        href={href}
        className={className}
        aria-label={label}
        data-header-nav=""
        data-pending={pending ? "true" : undefined}
        aria-busy={pending || undefined}
        aria-disabled={navigating || undefined}
        onClick={event => navigate(event, href, target)}
      >
        {children}
      </Link>
    );
  }

  return (
    <header className={`surface-dark ${styles.header}`} data-navigating={navigating ? "true" : undefined}>
      <span className={styles.progress} data-active={navigating ? "true" : "false"} aria-hidden="true" />
      <div className={styles.row}>
        {navLink(homeHref, "home", <Lockup surface="dark" />, styles.lockup, labels.appName)}

        <button
          ref={menuButtonRef}
          className={styles.menuButton}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {labels.menu}
        </button>

        <div
          id={menuId}
          className={styles.panel}
          data-open={menuOpen}
          onClick={(event) => {
            // Header destinations close the menu themselves once navigation ends.
            if (
              event.target instanceof Element &&
              event.target.closest("a") &&
              !event.target.closest("[data-header-nav]")
            ) {
              setMenuOpen(false);
            }
          }}
        >
          <nav aria-label={labels.menu} aria-busy={navigating || undefined} className={styles.navigation}>
            {navLink(screenHref, "stock", labels.screenStock)}
            {navLink(methodologyHref, "methodology", labels.methodologies)}
          </nav>
          <div className={styles.accountAndTheme}>
            <ThemeToggle />
            <div className={styles.account}>{accountControl}</div>
          </div>
        </div>

        <LocaleSwitcher className={styles.localeSwitcher} />
      </div>
    </header>
  );
}
