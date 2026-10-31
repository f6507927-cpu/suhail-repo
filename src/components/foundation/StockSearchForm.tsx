import { useTranslations } from "next-intl";
import { LocalizedText } from "./shared";

export function StockSearchForm({ locale, query = "", compact = false }: {
  locale: "ar" | "en"; query?: string; compact?: boolean;
}) {
  const t = useTranslations("publicSearch");
  const id = compact ? "header-stock-query" : "stock-query";
  return (
    <form action={locale === "en" ? "/en/search" : "/search"} method="get" role="search"
      aria-label={t("title")} className={`flex flex-wrap items-end gap-2 ${compact ? "max-w-xs" : "max-w-xl"}`}>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className={compact ? "sr-only" : "mb-2 block text-sm"}>
          <LocalizedText>{t("label")}</LocalizedText>
        </label>
        <input id={id} name="q" type="search" maxLength={40} defaultValue={query}
          placeholder={compact ? t("label") : undefined}
          className="w-full rounded-md border border-[var(--divider)] bg-background px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <button type="submit" className="rounded-md border border-[var(--divider)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <LocalizedText>{t("submit")}</LocalizedText>
      </button>
    </form>
  );
}
