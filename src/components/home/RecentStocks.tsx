"use client";

import { useSyncExternalStore } from "react";
import { TickerMonogram } from "../foundation/TickerMonogram";
import { RECENT_EVENT, RECENT_KEY, parseRecent, writeRecent, type RecentStock } from "../foundation/recent-stocks";
import { uxPolishText } from "@/i18n/proposed-arabic-ux-polish";

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === RECENT_KEY || event.key === null) listener(); };
  window.addEventListener(RECENT_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(RECENT_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
function snapshot() {
  try {
    return window.localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}
const serverSnapshot = () => null;

/** Hidden when empty; the server HTML is always empty, so the page stays cacheable. */
export function RecentStocks({ locale }: { locale: "ar" | "en" }) {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return <RecentStocksList items={parseRecent(raw)} locale={locale} onClear={() => writeRecent([])} />;
}

export function RecentStocksList({ items, locale, onClear }: { items: RecentStock[]; locale: "ar" | "en"; onClear?: () => void }) {
  if (!items.length) return null;
  const prefix = locale === "en" ? "/en" : "";
  return (
    <section className="recent-stocks" aria-labelledby="home-recent-title" data-recent-stocks>
      <div className="recent-head">
        <h2 id="home-recent-title">{uxPolishText(locale, "recentTitle")}</h2>
        <button type="button" className="recent-clear" onClick={onClear} aria-label={uxPolishText(locale, "recentClearLabel")}>
          {uxPolishText(locale, "recentClear")}
        </button>
      </div>
      <ul className="recent-list">
        {items.map(item => {
          const arabic = locale === "ar" && item.nameAr?.trim();
          return (
            <li key={item.slug}>
              <a href={`${prefix}/stock/${encodeURIComponent(item.slug)}`} className="recent-item">
                <TickerMonogram ticker={item.ticker} size="sm" />
                <span className="recent-text">
                  <bdi className="recent-name" lang={arabic ? "ar" : "en"} dir={arabic ? "rtl" : "ltr"}>{arabic || item.name}</bdi>
                  <bdi className="recent-ticker" dir="ltr">{item.ticker}</bdi>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="recent-note">{uxPolishText(locale, "recentNote")}</p>
    </section>
  );
}
