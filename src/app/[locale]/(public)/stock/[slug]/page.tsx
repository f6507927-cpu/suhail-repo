import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getPublicStockData } from "../../../../../db/stock-public";
import { getSiteUrl } from "../../../../../env/site";
import { stockMetadata } from "../../../../../stock/metadata";
import { StockVerdict } from "../../../../../components/stock/StockVerdict";

// D-20/D-102: classic on-demand ISR, no build-time DB or request reads.
export const revalidate = 900;
export const dynamic = "force-static";
export const dynamicParams = true;
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ locale: "ar" | "en"; slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await getPublicStockData(slug);
  if (!data) notFound();
  return stockMetadata(data, locale, getSiteUrl());
}
export default async function StockPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await getPublicStockData(slug);
  if (!data) notFound();
  // Database errors propagate; never publish/cache a successful error fallback.
  return <StockVerdict data={data} locale={locale} />;
}
