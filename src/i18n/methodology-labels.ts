/** D-159: known launch-time wording is not the current governance state.
 * Display-only: retain stored labels, workflow badges and arbitrary names.
 */
export function publicMethodologyVersionLabel(label: string | null | undefined, version = "") {
  const known: Record<string, string> = {
    "Adapted research 1.0 — draft": "Adapted research 1.0",
    "Adapted research 1.1 — draft; Suhail upper-bound assumption":
      "Adapted research 1.1 — Suhail upper-bound assumption",
  };
  const value = label || version;
  return known[value] ?? value;
}
