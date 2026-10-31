"use client";

import { useLocale, useTranslations } from "next-intl";
import { getPathname, usePathname } from "@/i18n/navigation";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("controls");
  const nextLocale = locale === "ar" ? "en" : "ar";

  return (
    // A locale changes the root html language/direction. Use a document
    // navigation so the D-22 before-paint script also restores the saved theme.
    <a
      href={getPathname({ href: pathname, locale: nextLocale })}
      lang={t("locale").startsWith("⟦AR-REVIEW⟧ ") ? "en" : locale}
      aria-label={t("locale")}
      className={className}
    >
      <span lang={nextLocale} dir={nextLocale === "ar" ? "rtl" : "ltr"}>
        {nextLocale === "ar" ? "العربية" : "English"}
      </span>
    </a>
  );
}
