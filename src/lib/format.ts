import type { Locale } from "../i18n/routing";

const formats = { ar: "ar-u-ca-gregory-nu-latn", en: "en-US" } as const;
// D-121: instants use Saudi time; calendar dates never move between zones.
export const DISPLAY_TIME_ZONE = "Asia/Riyadh";
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(formats[locale], {
    maximumFractionDigits: 2,
    ...options,
    numberingSystem: "latn",
  }).format(value);
}
/** Input is a fraction, e.g. -0.125 → -12.5%. */
export function formatPercent(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return formatNumber(value, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
    style: "percent",
  });
}
/** unitScale explicitly declares the input's multiplier (1, 1_000, etc). */
export function formatMoney(
  value: number,
  locale: Locale,
  currency: string,
  unitScale: number,
) {
  if (!Number.isFinite(unitScale) || unitScale <= 0)
    throw new RangeError("unitScale must be positive and finite");
  return formatNumber(value * unitScale, locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
}
/** UX-2 / D-21: summary dollars, at most three significant figures in either locale. */
export function formatCompactMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", notation: "compact",
    maximumSignificantDigits: 3, numberingSystem: "latn",
  }).format(value);
}

/** D-148 extends D-30: curate presentation without replacing SEC issuer identity. */
export function englishCompanyName(company: { name: string; display_name_en?: string | null }) {
  return company.display_name_en?.trim() || company.name;
}
export function formatDate(
  value: Date | string | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return formatCalendarDate(value, locale, options);
  return formatTimestamp(value, locale, options);
}

function dateOptions(options?: Intl.DateTimeFormatOptions) {
  // Intl rejects component fields combined with dateStyle/timeStyle.
  return options?.dateStyle || options?.timeStyle
    ? options
    : { year: "numeric" as const, month: "long" as const, day: "numeric" as const, ...options };
}

export function formatTimestamp(
  value: Date | string | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
) {
  if (value == null || value === "") return "—";
  return new Intl.DateTimeFormat(formats[locale], {
    ...dateOptions(options),
    ...options,
    timeZone: options?.timeZone ?? DISPLAY_TIME_ZONE,
    calendar: "gregory",
    numberingSystem: "latn",
  }).format(new Date(value));
}

/** A database DATE is not an instant. UTC here is only a stable rendering anchor. */
export function formatCalendarDate(
  value: string | null | undefined,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Expected YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new RangeError("Invalid calendar date");
  return formatTimestamp(date, locale, { ...dateOptions(options), timeZone: "UTC" });
}
