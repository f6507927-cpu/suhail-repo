import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Disclaimer,
  LocalizedText,
} from "../../../components/foundation";
import { SiteHeader } from "../../../components/foundation/SiteHeader";
import { FullDisclaimerLink } from "../../../components/foundation/FullDisclaimerLink";
import { LocaleDocument, documentMetadata } from "../../../components/foundation/LocaleDocument";
import { AccountControl } from "../../../components/accounts/AccountControl";
export const metadata = documentMetadata;
export const revalidate = 900;
// Static policy belongs to each leaf: search alone must read searchParams.
export function generateStaticParams() {
  // D-102: no database access or public-page rendering during CI/image builds.
  // Static locale/pages are generated and cached on their first runtime request.
  return [];
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  return (
    <LocaleDocument locale={locale}>
      <a
        href="#content"
        className="fixed start-4 top-2 z-50 -translate-y-24 bg-card px-4 py-2 text-card-foreground focus:translate-y-0"
      >
        <LocalizedText>{t("controls.skip")}</LocalizedText>
      </a>
      <SiteHeader
        locale={locale === "en" ? "en" : "ar"}
        labels={{
          appName: t("app.name"),
          menu: t("nav.menu"),
          picks: t("nav.picks"),
          methodologies: t("nav.methodologies"),
        }}
        accountControl={<AccountControl locale={locale === "en" ? "en" : "ar"} />}
      />
      {children}
      <footer className="mx-auto max-w-6xl border-t border-[var(--divider)] px-6 py-8 text-sm text-muted-foreground">
        <section id="full-disclaimer" tabIndex={-1} className="max-w-prose" aria-label={t("controls.fullDisclaimer")}>
          <Disclaimer variant="full" />
        </section>
        <FullDisclaimerLink />
      </footer>
    </LocaleDocument>
  );
}
