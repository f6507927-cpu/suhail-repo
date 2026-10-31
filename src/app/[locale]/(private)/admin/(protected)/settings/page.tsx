import { getTranslations } from "next-intl/server";
import { SettingsAdminScreen, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { readSettings } from "@/lib/auth/admin-data";
import { saveSettings } from "../actions";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Settings");
}

export default async function AdminSettingsPage({ params }: PageProps) {
  const { locale: routeLocale } = await params;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  await requirePageRole(locale, localePath(locale, "/admin/settings"), ["admin"]);
  const result = await readSettings();
  return (
    <section aria-label={t("nav.admin")}>
      <SettingsAdminScreen
        locale={locale}
        settings={result.settings}
        versions={result.versions}
        saveSettings={saveSettings}
      />
    </section>
  );
}
