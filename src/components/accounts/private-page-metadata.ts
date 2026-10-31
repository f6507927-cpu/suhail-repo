import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { reviewText } from "./types";

export async function privatePageMetadata(locale: string, title: string): Promise<Metadata> {
  const t = await getTranslations({ locale });
  const normalizedLocale = locale === "en" ? "en" : "ar";
  return {
    title: `${reviewText(normalizedLocale, title)} · ${t("app.name")}`,
    robots: { index: false, follow: false },
  };
}
