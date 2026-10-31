import { getTranslations } from "next-intl/server";
import { AuditAdminScreen, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { readAudit } from "@/lib/auth/admin-data";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    event?: string | string[];
    entity?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
  }>;
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
  return privatePageMetadata(locale, "Audit trail");
}

export default async function AdminAuditPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  await requirePageRole(locale, localePath(locale, "/admin/audit"), ["admin"]);
  const filters = {
    event: (first(query.event) ?? "").slice(0, 120) || undefined,
    entity: (first(query.entity) ?? "").slice(0, 120) || undefined,
    from: first(query.from) || undefined,
    to: first(query.to) || undefined,
    page: pageNumber(query.page),
  };
  const result = await readAudit(filters);
  return (
    <section aria-label={t("nav.admin")}>
      <AuditAdminScreen
        key={JSON.stringify(filters)}
        locale={locale}
        initialRows={result.rows}
        initialPage={result.page}
        initialTotal={result.total}
        initialFilters={{
          event: filters.event,
          entity: filters.entity,
          from: filters.from,
          to: filters.to,
        }}
      />
    </section>
  );
}
