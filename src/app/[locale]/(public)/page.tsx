import { setRequestLocale } from "next-intl/server";
import { HomePage } from "../../../components/home/HomePage";
import { getPublicHome } from "../../../db/home-public";

export const revalidate = 900;
export const dynamic = "force-static";
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomePage locale={locale==="en"?"en":"ar"} data={await getPublicHome()} />;
}
