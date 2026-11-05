"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { isEnglishText } from "@/i18n/display-text";
import { Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";
import { LocalizedText } from "./shared";
import { THEME_COLORS } from "../../lib/theme-script";

const THEME_KEY = "suhail-theme";
type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",THEME_COLORS[theme]);
  window.dispatchEvent(new Event("suhail-theme-change"));
}

function subscribe(listener: () => void) {
  window.addEventListener("suhail-theme-change", listener);
  return () => window.removeEventListener("suhail-theme-change", listener);
}
function snapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function serverSnapshot(): Theme {
  return "dark";
}
function hydratedSnapshot() {
  return true;
}
function serverHydratedSnapshot() {
  return false;
}

export function ThemeToggle() {
  const t = useTranslations("controls");
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const hydrated = useSyncExternalStore(
    subscribe,
    hydratedSnapshot,
    serverHydratedSnapshot,
  );

  function toggleTheme() {
    // The early script may have changed the DOM before hydration updates the
    // external-store snapshot. Read the applied theme at interaction time.
    const next: Theme = snapshot() === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // The current page remains usable when persistence is blocked.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("theme")}
      lang={isEnglishText(t("theme")) ? "en" : undefined}
      dir={isEnglishText(t("theme")) ? "ltr" : undefined}
      aria-pressed={theme === "dark"}
      title={t("theme")}
      disabled={!hydrated}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Moon aria-hidden="true" size={18} strokeWidth={1.6} />
      ) : (
        <Sun aria-hidden="true" size={18} strokeWidth={1.6} />
      )}
      <span className="sr-only">
        <LocalizedText>{t(theme)}</LocalizedText>
      </span>
    </Button>
  );
}
