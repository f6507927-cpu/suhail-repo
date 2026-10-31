import { redirect } from "next/navigation";
import { ConsentScreen } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requireConsentUser } from "@/lib/auth/guards";
import { currentConsent } from "@/lib/auth/policies";
import { localePath, safeNext } from "@/lib/auth/paths";
import type { Locale } from "@/components/accounts";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Review your agreement");
}

export default async function ConsentPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const next = safeNext(Array.isArray(query.next) ? query.next[0] : query.next);
  const context = await requireConsentUser(locale, next ?? localePath(locale, "/account"));
  if (currentConsent(context.user)) redirect(next ?? localePath(locale, "/account"));

  return <ConsentScreen locale={locale} next={next ?? localePath(locale, "/account")} backTo={next ?? localePath(locale, "/")} />;
}
