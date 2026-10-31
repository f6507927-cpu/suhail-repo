import { getTranslations } from "next-intl/server";
import { FinancialAdmin } from "@/components/financial/FinancialAdmin";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import type { Locale } from "@/components/accounts/types";
import { requireRole } from "@/lib/auth/guards";
import { getFinancialAdminData } from "@/lib/financial/data";
import { getScreeningAdminData } from "@/screening/data";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Ingestion");
}

export default async function IngestionAdminPage({ params }: PageProps) {
  const { locale: routeLocale } = await params;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const context = await requireRole(["admin", "editor"]);
  const t = await getTranslations({ locale });
  const [data, screening] = await Promise.all([getFinancialAdminData(), getScreeningAdminData()]);
  return <section aria-label={t("nav.admin")}>
    <FinancialAdmin data={data} screening={screening} role={context.user.role as "admin" | "editor"} view="ingestion" />
  </section>;
}
