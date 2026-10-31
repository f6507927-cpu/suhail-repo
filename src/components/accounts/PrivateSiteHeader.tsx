import "server-only";
import { getTranslations } from "next-intl/server";
import { AccountIdentityControl } from "./AccountIdentityControl";
import { AuthError } from "@/lib/auth/errors";
import { requireUser } from "@/lib/auth/guards";
import { SiteHeader } from "@/components/foundation/SiteHeader";
import type { Locale } from "./types";

export async function PrivateSiteHeader({ locale, publicOnly = false }: { locale: Locale; publicOnly?: boolean }) {
  const t = await getTranslations({ locale });
  let identity: { fullName: string; role: "user" | "editor" | "admin" } | null = null;

  try {
    // Private navigation needs identity only; consent, role, and AAL2 gates belong to the page.
    const context = await requireUser({ consent: false });
    identity = { fullName: context.user.full_name, role: context.user.role };
  } catch (error) {
    if (
      !(error instanceof AuthError) ||
      (error.code !== "sign_in_required" && error.code !== "recovery_required")
    ) {
      throw error;
    }
  }

  return (
    <SiteHeader
      locale={locale}
      labels={{
        appName: t("app.name"),
        menu: t("nav.menu"),
        picks: t("nav.picks"),
        methodologies: t("nav.methodologies"),
      }}
      accountControl={publicOnly ? null : <AccountIdentityControl locale={locale} identity={identity} />}
    />
  );
}
