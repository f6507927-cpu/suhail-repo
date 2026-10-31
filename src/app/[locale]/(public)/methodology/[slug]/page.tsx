import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  getPublicMethodology,
} from "../../../../../db/methodology-public";
import { MethodologyDetail } from "../../../../../components/methodology/MethodologyDetail";
import { PublicMethodologyVersions } from "../../../../../components/methodology/PublicMethodologyVersions";

// D-20: documentation is ISR-cacheable; no request headers or cookies are read.
export const revalidate = 900;
// Unknown slugs are statically generated on demand; selection never reads
// searchParams on the server, which would opt this route out of classic ISR.
export const dynamic = "force-static";
export async function generateStaticParams() {
  return [];
}

export default async function MethodologyVersionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // A failed read must never become a cached success/error fallback.
  const data = await getPublicMethodology(slug);
  if (!data) notFound();
  return (
    <PublicMethodologyVersions
      defaultVersion={data.defaultVersion}
      versions={data.documents.map(({ version }) => ({
        value: version.version,
        label: version.version_label ?? version.version,
      }))}
    >
      {data.documents.map(({ version, criteria }) => (
        <MethodologyDetail
          key={version.version}
          methodology={data.methodology}
          version={version}
          criteria={criteria}
          locale={locale}
        />
      ))}
    </PublicMethodologyVersions>
  );
}
