"use client";

import { useEffect, useRef, type ReactNode } from "react";

export const ENTRANCE_FRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(20px)" },
  { opacity: 1, transform: "translateY(0)" },
];
export const RATIO_FRAMES: Keyframe[] = [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
export const STAGGER_MS = 80;

/** UX-7/D-22/D-40: enhance visible SSR content, never hide it with a JS/CSS gate.
 * Web Animations supplies only transform/opacity; no inline scripts or HTML.
 */
export function installPublicMotion(root: HTMLElement, played: WeakSet<Element>) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const active = new Set<Animation>();
  let observer: IntersectionObserver | undefined;
  let mutations: MutationObserver | undefined;
  const cancel = () => { active.forEach(animation => animation.cancel()); active.clear(); };
  const stop = () => { observer?.disconnect(); mutations?.disconnect(); cancel(); };
  const setup = () => {
    stop();
    if (preference.matches || !window.IntersectionObserver || !root.animate) return;
    observer = new IntersectionObserver(entries => {
      let stagger = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting || played.has(entry.target)) continue;
        const element = entry.target as HTMLElement;
        played.add(element);
        observer?.unobserve(element);
        const focused = document.activeElement;
        if (focused && focused !== document.body && (element.contains(focused) || focused.contains(element))) continue;
        const animation = element.animate(element.hasAttribute("data-ux-ratio") ? RATIO_FRAMES : ENTRANCE_FRAMES, {
          duration: 420, delay: stagger++ * STAGGER_MS, easing: "ease-out", fill: "backwards",
        });
        active.add(animation);
        animation.onfinish = () => active.delete(animation);
      }
    }, { threshold: 0.08 });
    const refresh = () => {
      const candidates = [...root.querySelectorAll<HTMLElement>(
        "main h1,main h2,main h3,main p,main article,[data-ux-card],main li > a,footer p",
      )].filter(element => !element.matches("article") || !element.querySelector("article,section"));
      const selected = new Set<Element>(candidates);
      for (const element of candidates) {
        // A card's text enters with its parent, not with a second nested transform.
        let parent = element.parentElement;
        while (parent && parent !== root && !selected.has(parent)) parent = parent.parentElement;
        if ((!parent || parent === root) && !played.has(element)) observer?.observe(element);
      }
      root.querySelectorAll<HTMLElement>("[data-ux-ratio]").forEach(element => {
        if (!played.has(element)) observer?.observe(element);
      });
    };
    refresh();
    // Next navigation/streamed results can insert content into the persistent layout.
    mutations = new MutationObserver(refresh);
    mutations.observe(root, { childList: true, subtree: true });
  };
  setup();
  preference.addEventListener("change", setup);
  root.addEventListener("focusin", cancel);
  return () => { stop(); preference.removeEventListener("change", setup); root.removeEventListener("focusin", cancel); };
}

export function PublicMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(new WeakSet<Element>());
  useEffect(() => root.current ? installPublicMotion(root.current, played.current) : undefined, []);
  return <div ref={root} data-public-ux>{children}</div>;
}
