"use client";
import { useEffect, useState, type ReactNode } from "react";
import styles from "./OtherMethodologies.module.css";

export const METHODOLOGY_PREFERENCE_KEY = "suhail.methodology";
type Option = { slug: string; label: ReactNode; isDefault: boolean };

/** Choose a valid slug: ?m= link first, then this browser's saved choice, else
 * the site default. Never writes to the server or the site default (D-174). */
export function initialMethodology(slugs: string[], defaultSlug: string, search: string, saved: string | null) {
  const linked = new URLSearchParams(search).get("m");
  if (linked && slugs.includes(linked)) return linked;
  if (saved && slugs.includes(saved)) return saved;
  return defaultSlug;
}
function readSaved() {
  try { return window.localStorage.getItem(METHODOLOGY_PREFERENCE_KEY); } catch { return null; }
}
function save(slug: string, defaultSlug: string) {
  try {
    if (slug === defaultSlug) window.localStorage.removeItem(METHODOLOGY_PREFERENCE_KEY);
    else window.localStorage.setItem(METHODOLOGY_PREFERENCE_KEY, slug);
  } catch { /* storage unavailable: the choice lasts for this page only */ }
}

export function MethodologySwitcher({ options, defaultSlug, cards, legend, defaultNote }: {
  options: Option[]; defaultSlug: string; cards: Record<string, ReactNode>; legend: ReactNode; defaultNote: ReactNode;
}) {
  // Server and first client render match: the site default (all results listed).
  const [selected, setSelected] = useState(defaultSlug);
  const slugs = options.map(o => o.slug);
  useEffect(() => {
    // Hydration-safe one-time read of the URL and this browser's saved choice.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(initialMethodology(slugs, defaultSlug, window.location.search, readSaved()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function choose(slug: string) {
    setSelected(slug);
    save(slug, defaultSlug);
    const url = new URL(window.location.href);
    if (slug === defaultSlug) url.searchParams.delete("m"); else url.searchParams.set("m", slug);
    window.history.replaceState(window.history.state, "", url);
  }
  return (
    <div data-selected-methodology={selected}>
      <fieldset className={styles.switcher}>
        <legend className={styles.legend}>{legend}</legend>
        <div className={styles.options}>
          {options.map(o => (
            <button key={o.slug} type="button" className={styles.option} aria-pressed={selected === o.slug}
              data-methodology-option={o.slug} onClick={() => choose(o.slug)}>{o.label}</button>
          ))}
        </div>
      </fieldset>
      {selected === defaultSlug
        ? <>{defaultNote}<div className={styles.cards}>{Object.values(cards)}</div></>
        : <div className={styles.cards}>{cards[selected]}</div>}
    </div>
  );
}
