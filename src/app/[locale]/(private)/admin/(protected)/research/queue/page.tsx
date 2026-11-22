import { and, eq } from "drizzle-orm";
import { dbApp } from "@/db/app";
import { analystProfile } from "@/db/schema/accounts";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { requestResearchRefresh } from "@/lib/research/actions";
import { researchRefreshQueue } from "@/lib/research/stale-store";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { ResearchQueue } from "@/components/research/ResearchQueue";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return privatePageMetadata((await params).locale, "Research refresh queue");
}
export default async function QueuePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale === "en" ? "en" : "ar";
  const context = await requirePageRole(locale, localePath(locale, "/admin/research/queue"));
  const [rows, [analyst]] = await Promise.all([researchRefreshQueue(),
    dbApp.select({ id: analystProfile.id }).from(analystProfile)
      .where(and(eq(analystProfile.user_id, context.user.id), eq(analystProfile.active, true)))]);
  return <ResearchQueue locale={locale} rows={rows} activeAnalyst={!!analyst} requestAction={requestResearchRefresh} />;
}
