// D-181: founder-chosen public name for the default methodology (8 November 2026).
// Presentation only: the stored methodology record, its history and the approved
// UI-1 pair stay unchanged. The source credit (document title, link and notes)
// remains on the methodology page.
const coreMethodology = ["منهجية سهيل الأساسية", "Suhail core methodology"] as const;

export const methodologyPublicNames: Readonly<Record<string, readonly [ar: string, en: string]>> = {
  "Research implementation based on publicly documented criteria from Al Rajhi Capital": coreMethodology,
  "Al Rajhi criteria — adapted research": coreMethodology,
};

/** The public display name for a stored methodology name or short label, if renamed. */
export function methodologyPublicName(value: string | null | undefined, locale: "ar" | "en"): string | null {
  if (!value || !Object.hasOwn(methodologyPublicNames, value)) return null;
  return methodologyPublicNames[value][locale === "ar" ? 0 : 1];
}
