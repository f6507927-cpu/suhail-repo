import { redirect } from "next/navigation";
import type { Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { methodologyHref } from "@/lib/methodology/navigation";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<{ methodology?: string | string[]; version?: string | string[] }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Methodologies");
}

export default async function AdminHomePage({ params, searchParams }: PageProps) {
  const { locale: routeLocale } = await params;
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  await requirePageRole(locale, localePath(locale, "/admin"), ["admin", "editor"]);
  const query = await searchParams;
  redirect(methodologyHref(locale, {
    methodology: typeof query.methodology === "string" ? query.methodology : undefined,
    version: typeof query.version === "string" ? query.version : undefined,
  }));
}
