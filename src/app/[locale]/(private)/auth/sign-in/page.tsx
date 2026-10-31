import { getTranslations } from "next-intl/server";
import { SignInScreen } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { safeNext } from "@/lib/auth/paths";
import type { Locale } from "@/components/accounts";

type SearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;
type PageProps = { params: Promise<{ locale: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Sign in");
}

export default async function SignInPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error;
  const providerError =
    errorCode === "provider"
      ? "Google sign-in could not be started. Please try again."
      : errorCode === "cancelled"
        ? "Sign-in was cancelled. You can try again."
        : null;

  return (
    <SignInScreen
      locale={locale}
      next={safeNext(Array.isArray(query.next) ? query.next[0] : query.next)}
      valueStatement={t("app.tagline")}
      providerError={providerError}
    />
  );
}
