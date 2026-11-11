import { uiEightVersion } from "./approved-arabic-ui-eight";

/** D-159/D-182: known launch-time wording is not the current governance state.
 * Display-only: retain stored labels, workflow badges and arbitrary names.
 */
export function publicMethodologyVersionLabel(label: string | null | undefined, version = "") {
  const known: Record<string, string> = {
    "Adapted research 1.0 — draft": "Adapted research 1.0",
    "Adapted research 1.1 — draft; Suhail upper-bound assumption":
      "Adapted research 1.1 — Suhail upper-bound assumption",
    // Apply after the approved display mappings, including UI-8's compact form.
    "الإصدار 1.0 · مسودة": "الإصدار 1.0",
    "Version 1.0 · Draft": "Version 1.0",
    [uiEightVersion.ar.short]: "الإصدار 1.1",
    [uiEightVersion.en.short]: "Version 1.1",
    [uiEightVersion.ar.full]: uiEightVersion.ar.full.replace(" · مسودة", ""),
    [uiEightVersion.en.full]: uiEightVersion.en.full.replace(" · Draft", ""),
  };
  const value = label || version;
  return known[value] ?? value;
}
