import { headers } from "next/headers";
import { LocaleDocument, documentMetadata } from "../../../components/foundation/LocaleDocument";
import { PrivateSiteHeader } from "@/components/accounts/PrivateSiteHeader";
export const dynamic = "force-dynamic";
export const metadata = {...documentMetadata, robots:{index:false,follow:false}};
export default async function PrivateLayout({children,params}: {children:React.ReactNode;params:Promise<{locale:string}>}) {
  const {locale} = await params;
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const path = (requestHeaders.get("x-private-path")?.split(/[?#]/)[0] ?? "").replace(/^\/(?:en|ar)(?=\/)/, "");
  const protectedAdmin = /^\/admin(?:\/|$)/.test(path) && !/^\/admin\/mfa(?:\/|$)/.test(path);
  return <LocaleDocument locale={locale} nonce={nonce}>
    {!protectedAdmin && <PrivateSiteHeader locale={locale === "en" ? "en" : "ar"} publicOnly={/^\/admin\/mfa(?:\/|$)/.test(path)} />}
    {children}
  </LocaleDocument>;
}
