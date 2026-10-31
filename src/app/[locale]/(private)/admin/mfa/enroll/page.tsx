import { getTranslations } from "next-intl/server";
import { MfaClientPanel, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requireMfaUser } from "@/lib/auth/guards";
import { localePath, safeNext } from "@/lib/auth/paths";
import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Authenticator enrollment");
}

export default async function MfaEnrollPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  const requestedNext = safeNext(Array.isArray(query.next) ? query.next[0] : query.next);
  const context = await requireMfaUser(locale, requestedNext ?? localePath(locale, "/admin"));
  const factors = await context.auth.auth.mfa.listFactors();
  if (factors.error) throw new AuthError(503, "mfa_status_unavailable");
  if (factors.data.totp.some(f => f.status === "verified"))
    redirect(`${localePath(locale, "/admin/mfa/verify")}?next=${encodeURIComponent(requestedNext ?? localePath(locale, "/admin"))}`);
  return (
    <div lang={locale} aria-label={t("app.name")}>
      <MfaClientPanel
        locale={locale}
        mode="enroll"
        next={requestedNext ?? localePath(locale, "/admin")}
        backTo={requestedNext ?? localePath(locale, "/")}
      />
    </div>
  );
}
