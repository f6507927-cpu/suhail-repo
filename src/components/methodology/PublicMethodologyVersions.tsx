"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LocalizedText } from "../foundation";

export type PublicVersionChoice = { value: string; label: string };

export function PublicMethodologyVersions({
  versions,
  defaultVersion,
  children,
}: {
  versions: PublicVersionChoice[];
  defaultVersion: string;
  children: ReactNode;
}) {
  const t = useTranslations("publicMethodology");
  const [selected, setSelected] = useState(defaultVersion);
  const panels = Children.toArray(children);
  const validValues = useMemo(() => versions.map((version) => version.value), [versions]);
  const selectedIndex = Math.max(0, validValues.indexOf(selected));

  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("version");
    if (!requested) return;
    if (validValues.includes(requested)) {
      const frame = window.requestAnimationFrame(() => setSelected(requested));
      return () => window.cancelAnimationFrame(frame);
    } else {
      // Invalid selectors, including old/private IDs, fall back to the server-selected
      // public production/latest version and are removed from the address bar.
      url.searchParams.delete("version");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [defaultVersion, validValues]);

  const changeVersion = (value: string) => {
    if (!validValues.includes(value)) return;
    setSelected(value);
    const url = new URL(window.location.href);
    url.searchParams.set("version", value);
    window.history.replaceState(window.history.state, "", url);
  };

  return (
    <main id="content">
      <section aria-label={t("versionSelector")} className="mx-auto max-w-6xl px-5 pt-7 sm:px-8">
        <div className="flex flex-col gap-3 border-s-2 border-[var(--brass)] bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm text-[var(--byline)]">{t("publicVersion")}</p>
            <p className="mt-1 text-xs text-muted-foreground"><LocalizedText>{t("publishedVersionsOnly")}</LocalizedText></p>
          </div>
          <label htmlFor="public-version-selector" className="flex w-full items-center gap-3 sm:max-w-sm">
            <span className="sr-only"><LocalizedText>{t("chooseVersion")}</LocalizedText></span>
            <select id="public-version-selector" value={selected} onChange={(event) => changeVersion(event.target.value)}
              className="min-h-11 w-full border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brass)]">
              {versions.map((version) => (
                <option key={version.value} value={version.value}>{version.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {panels.map((panel, index) => (
        <div key={versions[index]?.value ?? index} hidden={index !== selectedIndex}>
          {panel}
        </div>
      ))}
    </main>
  );
}
