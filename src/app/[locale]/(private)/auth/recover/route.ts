import { NextResponse } from "next/server";
import { verifiedIdentity } from "../../../../../lib/auth/guards";
import { registerIdentity } from "../../../../../lib/auth/registration";
import { localePath, safeNext } from "../../../../../lib/auth/paths";
import { currentConsent } from "../../../../../lib/auth/policies";
import { authOrigin } from "../../../../../lib/auth/origin";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  try {
    const { identity } = await verifiedIdentity();
    // Recovery never asserts previously missing acceptance. Re-consent explicitly.
    const user = await registerIdentity(
      identity,
      locale === "en" ? "en" : "ar",
      false,
    );
    const target =
      safeNext(new URL(request.url).searchParams.get("next")) ??
      localePath(user.locale_pref, "/");
    return NextResponse.redirect(
      new URL(
        currentConsent(user)
          ? target
          : `${localePath(locale, "/auth/consent")}?next=${encodeURIComponent(target)}`,
        authOrigin(),
      ),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL(localePath(locale, "/auth/sign-in"), authOrigin()),
      303,
    );
  }
}
