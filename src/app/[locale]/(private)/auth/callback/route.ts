import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverAuth } from "../../../../../lib/auth/server";
import { registerIdentity } from "../../../../../lib/auth/registration";
import { currentConsent } from "../../../../../lib/auth/policies";
import { localePath, safeNext } from "../../../../../lib/auth/paths";
import { authOrigin } from "../../../../../lib/auth/origin";
export async function GET(request: Request, {params}: {params:Promise<{locale:string}>}) {
  const {locale} = await params;
  const url = new URL(request.url);
  const origin = authOrigin(request);
  const next = safeNext(url.searchParams.get("next"));
  try {
    const auth = await serverAuth();
    const code = url.searchParams.get("code");
    // Repeated/consumed callback may still recover from a verified existing session.
    if (code) await auth.auth.exchangeCodeForSession(code);
    const {data,error} = await auth.auth.getUser();
    if (error || !data.user) throw new Error("sign_in_failed");
    const store = await cookies();
    const user = await registerIdentity(data.user,locale === "en"?"en":"ar",store.get("suhail-consent")?.value==="1");
    store.delete("suhail-consent");
    const target = next ?? localePath(user.locale_pref,"/");
    const destination = currentConsent(user) ? target : `${localePath(locale,"/auth/consent")}?next=${encodeURIComponent(target)}`;
    return NextResponse.redirect(new URL(destination,origin),303);
  } catch {
    return NextResponse.redirect(new URL(`${localePath(locale,"/auth/sign-in")}?error=${url.searchParams.has("error")?"cancelled":"provider"}`,origin),303);
  }
}
