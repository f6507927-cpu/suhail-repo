/**
 * Recently viewed stocks, kept only in the visitor's own browser (localStorage).
 * Nothing is sent to the server and no cookie is written, so public pages stay
 * cookie-free and ISR-cacheable (D-20/D-22/D-51). Only public identity is kept:
 * slug, ticker and names. No status is stored, so the homepage can never show a
 * result that has since changed.
 */
export const RECENT_KEY = "suhail-recent-stocks";
export const RECENT_LIMIT = 6;
export const RECENT_EVENT = "suhail-recent-change";

export type RecentStock = { slug: string; ticker: string; name: string; nameAr: string | null };

function isRecent(value: unknown): value is RecentStock {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.slug === "string" && /^[a-z0-9][a-z0-9.-]{0,63}$/.test(item.slug) &&
    typeof item.ticker === "string" && item.ticker.length > 0 && item.ticker.length <= 12 &&
    typeof item.name === "string" && item.name.length <= 200 &&
    (item.nameAr === null || (typeof item.nameAr === "string" && item.nameAr.length <= 200));
}

export function parseRecent(raw: string | null): RecentStock[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function addRecent(list: RecentStock[], item: RecentStock): RecentStock[] {
  return [item, ...list.filter(entry => entry.slug !== item.slug)].slice(0, RECENT_LIMIT);
}

export function readRecent(): RecentStock[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

export function writeRecent(list: RecentStock[]) {
  try {
    if (list.length) window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    else window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Blocked storage only disables the convenience list.
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}
