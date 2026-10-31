import { getTranslations } from "next-intl/server";
import { MfaClientPanel, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requireMfaUser } from "@/lib/auth/guards";
import { localePath, safeNext } from "@/lib/auth/paths";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Authenticator verification");
}

export default async function MfaVerifyPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  const requestedNext = safeNext(Array.isArray(query.next) ? query.next[0] : query.next);
  await requireMfaUser(locale, requestedNext ?? localePath(locale, "/admin"));
  return (
    <div lang={locale} aria-label={t("app.name")}>
      <MfaClientPanel
        locale={locale}
        mode="verify"
        next={requestedNext ?? localePath(locale, "/admin")}
        backTo={requestedNext ?? localePath(locale, "/")}
      />
    </div>
  );
}
