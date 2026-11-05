import { formatDate } from "@/lib/format";
import styles from "./StockVerdict.module.css";

/** UI-2 / D-21: Arabic date prose is RTL body text; isolate only digit runs. */
export function StockDate({ value, locale }: {
  value: Date | string | null | undefined; locale: "ar" | "en";
}) {
  const text = formatDate(value, locale);
  const dateTime = value instanceof Date ? value.toISOString() : value || undefined;
  return <time dateTime={dateTime} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={styles.dateText}>
    {text.split(/(\d+)/).map((part, index) => /^\d+$/.test(part)
      ? <bdi dir="ltr" key={index}>{part}</bdi> : part)}
  </time>;
}
