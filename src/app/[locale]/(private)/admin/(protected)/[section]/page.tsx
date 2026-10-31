import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { DeferredAdminSection, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { readMethodologies } from "@/lib/methodology/admin-data";
import { AdminMethodologies } from "@/components/methodology/AdminMethodologies";
import { methodologyAction } from "../methodology-actions";

const sections = {
  methodologies: "Methodologies",
  securities: "Securities and data",
  ingestion: "Ingestion",
  editions: "Editions",
  analysts: "Analysts",
} as const;
type Section = keyof typeof sections;
type PageProps = {
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<{ methodology?: string | string[]; version?: string | string[] }>;
};
function isSection(value: string): value is Section {
  return Object.prototype.hasOwnProperty.call(sections, value);
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, section } = await params;
  return privatePageMetadata(locale, isSection(section) ? sections[section] : "Admin section");
}

export default async function DeferredSectionPage({ params, searchParams }: PageProps) {
  const { locale: routeLocale, section } = await params;
  if (!isSection(section)) notFound();
  const slug = section;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  if (slug === "methodologies") {
    const context = await requirePageRole(locale, localePath(locale, "/admin/methodologies"), ["admin", "editor"]);
    const data = await readMethodologies();
    const query = await searchParams;
    const selection = {
      methodology: typeof query.methodology === "string" ? query.methodology : undefined,
      version: typeof query.version === "string" ? query.version : undefined,
    };
    const role = context.user.role as "admin" | "editor";
    return (
      <section aria-label={t("nav.admin")}>
        <AdminMethodologies data={data} locale={locale} role={role} action={methodologyAction} selection={selection} />
      </section>
    );
  }
  await requirePageRole(locale, localePath(locale, `/admin/${slug}`), ["admin", "editor"]);
  return (
    <section aria-label={t("nav.admin")}>
      <DeferredAdminSection locale={locale} title={sections[slug]} />
    </section>
  );
}
