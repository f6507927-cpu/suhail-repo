import { getTranslations } from "next-intl/server";
import { AccountScreen, type Locale } from "@/components/accounts";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { requirePageUser } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { deleteAccount, updateLocale } from "./actions";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">) {
  const { locale } = await params;
  return privatePageMetadata(locale, "Your account");
}

export default async function AccountPage({ params, searchParams }: PageProps) {
  const [{ locale: routeLocale }, query] = await Promise.all([params, searchParams]);
  const locale: Locale = routeLocale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale });
  const nextValue = Array.isArray(query.next) ? query.next[0] : query.next;
  const context = await requirePageUser(locale, nextValue ?? localePath(locale, "/account"));

  return (
    <div lang={locale} aria-label={t("app.name")}>
      <AccountScreen
        locale={locale}
        profile={context.user}
        updateLocale={updateLocale}
        deleteAccount={deleteAccount}
      />
    </div>
  );
}
