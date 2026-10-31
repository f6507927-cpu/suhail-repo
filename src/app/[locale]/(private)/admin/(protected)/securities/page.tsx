import { getTranslations } from "next-intl/server";
import { FinancialAdmin } from "@/components/financial/FinancialAdmin";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import type { Locale } from "@/components/accounts/types";
import { requireRole } from "@/lib/auth/guards";
import { getFinancialAdminData } from "@/lib/financial/data";
import { getScreeningAdminData } from "@/screening/data";
import { getUnmetSearches } from "@/lib/financial/unmet-search";
import { UnmetSearchPanel } from "@/components/financial/UnmetSearchPanel";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Securities and data");
}

export default async function SecuritiesAdminPage({ params }: PageProps) {
  const { locale: routeLocale } = await params;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const context = await requireRole(["admin", "editor"]);
  const t = await getTranslations({ locale });
  const [data, screening] = await Promise.all([getFinancialAdminData(), getScreeningAdminData()]);
  const unmet = context.user.role === "admin" ? await getUnmetSearches() : null;
  return <section aria-label={t("nav.admin")}>
    <FinancialAdmin data={data} screening={screening} role={context.user.role as "admin" | "editor"} view="securities" />
    {unmet && <div className="mt-8"><UnmetSearchPanel rows={unmet} locale={locale} /></div>}
  </section>;
}
