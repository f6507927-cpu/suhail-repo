import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreeningRunDetail } from "@/components/financial/ScreeningControls";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import type { Locale } from "@/components/accounts/types";
import { requireRole } from "@/lib/auth/guards";
import { getRunDetail } from "@/screening/data";
import type { RunDetail } from "@/screening/contracts";

type PageProps = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Screening run");
}

export default async function ScreeningRunPage({ params }: PageProps) {
  const { locale: routeLocale, id } = await params;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const context = await requireRole(["admin", "editor"]);
  const t = await getTranslations({ locale });
  let detail: RunDetail;
  try {
    detail = await getRunDetail(id);
  } catch {
    notFound();
  }
  return <section aria-label={t("nav.admin")}>
    <ScreeningRunDetail detail={detail} role={context.user.role as "admin" | "editor"} />
  </section>;
}
