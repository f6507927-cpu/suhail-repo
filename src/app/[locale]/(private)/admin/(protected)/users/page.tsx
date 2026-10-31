import { getTranslations } from "next-intl/server";
import { UsersAdminScreen, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { searchUsers } from "@/lib/auth/admin-data";
import { changeRole } from "../actions";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
};
function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}
function pageNumber(value?: string | string[]) {
  const parsed = Number(first(value) ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Users");
}

export default async function AdminUsersPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  await requirePageRole(locale, localePath(locale, "/admin/users"), ["admin"]);
  const initialQuery = (first(query.q) ?? "").slice(0, 160);
  const initialPage = pageNumber(query.page);
  const result = await searchUsers(initialQuery, initialPage);
  return (
    <section aria-label={t("nav.admin")}>
      <UsersAdminScreen
        key={`${initialQuery}:${result.page}`}
        locale={locale}
        initialRows={result.rows}
        initialPage={result.page}
        initialTotal={result.total}
        initialQuery={initialQuery}
        changeRole={changeRole}
      />
    </section>
  );
}
