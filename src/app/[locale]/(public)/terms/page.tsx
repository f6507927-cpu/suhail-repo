import { setRequestLocale } from "next-intl/server";
import { LegalDocument } from "../../../../components/accounts/LegalDocument";
export const revalidate=900;
export const dynamic = "force-static";
export default async function Terms({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;setRequestLocale(locale);
  return <LegalDocument kind="terms" locale={locale}/>;
}
