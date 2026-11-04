"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
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

export function SiteHeader({ locale, labels, accountControl }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const homeHref = locale === "en" ? "/en" : "/";
  const screenHref = `${homeHref}#stock-query`;
  const methodologyHref = locale === "en" ? "/en/methodology" : "/methodology";

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

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`surface-dark ${styles.header}`}>
      <div className={styles.row}>
        <a className={styles.lockup} href={homeHref} aria-label={labels.appName}>
          <Lockup surface="dark" />
        </a>

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
            if (
              event.target instanceof Element &&
              event.target.closest("a")
            ) {
              closeMenu();
            }
          }}
        >
          <nav aria-label={labels.menu} className={styles.navigation}>
            <a href={screenHref}>
              {labels.screenStock}
            </a>
            <a href={methodologyHref}>
              {labels.methodologies}
            </a>
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
