import { setRequestLocale } from "next-intl/server";
import { getPublicMethodologies } from "../../../../db/methodology-public";
import { MethodologyDirectory } from "../../../../components/methodology/MethodologyDirectory";

// D-20: public methodology documentation is time-revalidated and remains
// independent of request cookies and headers.
export const revalidate = 900;
export const dynamic = "force-static";
// D-19/D-20/D-102: the parent layout returns no build-time locale params.
// Generate on the first request, never cache a failed database read.

export default async function Methodology({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Throw on failure: Next preserves the last successful ISR render.
  const groups = await getPublicMethodologies();
  return <MethodologyDirectory groups={groups} locale={locale} />;
}
