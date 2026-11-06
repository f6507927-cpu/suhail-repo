import { getPublicStockData } from "../../../../../db/stock-public";
import { OG_SIZE, stockOgImage } from "../../../../../stock/og-image";

// Same ISR policy as the stock page (D-20/D-102): public data only, no cookies or headers.
export const revalidate = 900;
export const dynamic = "force-static";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Suhail | سهيل";
export async function generateStaticParams() { return []; }

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  return stockOgImage(await getPublicStockData(slug), locale === "en" ? "en" : "ar");
}
