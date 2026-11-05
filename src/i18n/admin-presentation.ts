import { reviewText, type Locale } from "@/components/accounts/types";
import { presentationLabels, displayLabel } from "./presentation";
import { uiOneDisplay } from "./approved-arabic-ui-one";
import { uiNineLabels } from "./approved-arabic-ui-nine";

export function uiNineText(locale: Locale, source: string, values: Record<string, string | number> = {}) {
  const text = locale === "ar" && Object.hasOwn(uiNineLabels, source) ? uiNineLabels[source] : reviewText(locale, source);
  return text.replace(/\{(\w+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key]));
}
// The supplied count row repeats {count}; independently computed counts stay distinct.
export function adminInputCounts(locale: Locale, unknown: number, estimated: number) {
  const source = locale === "ar" ? uiNineLabels["{count} unknown · {count} estimated"] : "{count} unknown · {count} estimated";
  return source.replace("{count}", String(unknown)).replace("{count}", String(estimated));
}
export function adminFactLabel(lineItem: string, storedLabel: string | null | undefined, locale: Locale) {
  if (Object.hasOwn(presentationLabels.lineItem, lineItem)) return displayLabel("lineItem", lineItem, locale);
  return storedLabel && !["Unknown label", "تسمية غير معروفة"].includes(storedLabel) ? storedLabel : lineItem;
}
export function adminVersionLabel(value: { version?: string | null; version_label?: string | null; label?: string; methodologyName?: string }, locale: Locale, flags: { isDefault?: boolean; isExample?: boolean } = {}) {
  const label = value.version_label ?? value.label ?? "";
  const number = value.version || label.match(/(?:^|\s)(\d+\.\d+(?:\.\d+)*)\b/)?.[1] || "";
  const name = value.methodologyName ? uiOneDisplay(value.methodologyName, locale) : "";
  return [number, name, uiOneDisplay(label, locale), flags.isDefault ? uiNineText(locale, "(default)") : "", flags.isExample ? uiNineText(locale, "(example)") : ""].filter(Boolean).join(" · ");
}
