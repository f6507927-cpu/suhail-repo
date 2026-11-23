import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { dbApp } from "@/db/app";
import { security } from "@/db/schema/market";
import { researchDraft } from "@/db/schema/research";
import { ResearchList } from "@/components/research";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { requestResearchDraft, reconcileResearchDraft } from "@/lib/research/actions";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";
import { ARABIC_GENERATION_APPROVED } from "@/lib/research/prompt";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return privatePageMetadata((await params).locale, "Research drafts");
}
export default async function ResearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale === "en" ? "en" : "ar";
  const context = await requirePageRole(locale, localePath(locale, "/admin/research"));
  const rows = await dbApp.select({ id: researchDraft.id, ticker: security.ticker, state: researchDraft.state,
    publication: sql<string | null>`(select kind from app.research_publication_current where draft_id=${researchDraft.id})`,
    issues: researchDraft.validation_results }).from(researchDraft)
    .innerJoin(security, eq(security.id, researchDraft.security_id)).orderBy(desc(researchDraft.created_at)).limit(100);
  const securities = await dbApp.select({ id: security.id, ticker: security.ticker }).from(security)
    .where(and(eq(security.in_universe, true), eq(security.is_demo, false), isNotNull(security.coverage_analyst_id)));
  return <ResearchList locale={locale} generationApproved={ARABIC_GENERATION_APPROVED} rows={rows.map(row => ({
    id: row.id, ticker: row.ticker, state: row.state, publication: row.publication, blocks: row.issues.filter(i => i.severity === "block").length,
  }))} securities={securities} requestAction={requestResearchDraft}
    reconcileAction={context.user.role === "admin" ? reconcileResearchDraft : undefined}
    settingsHref={context.user.role === "admin" ? "/admin/research/settings" : null} />;
}
