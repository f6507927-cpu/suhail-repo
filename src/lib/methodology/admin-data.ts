import "server-only";
import { eq, desc } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { requireRole } from "../auth/guards";
import { methodology, methodologyVersion, methodologyCriterion, methodologyVersionReport } from "../../db/schema/methodology";
import { source } from "../../db/schema/market";

export async function readMethodologies() {
  await requireRole(["admin","editor"]);
  const [methodologies,versions,criteria,reports,sources]=await Promise.all([
  dbApp.select().from(methodology).orderBy(methodology.name),
  dbApp.select().from(methodologyVersion).orderBy(desc(methodologyVersion.created_at)),
  dbApp.select().from(methodologyCriterion).orderBy(methodologyCriterion.sort_order),
  dbApp.select().from(methodologyVersionReport).orderBy(desc(methodologyVersionReport.created_at)),
  dbApp.select({id:source.id,label:source.label,source_url:source.source_url,
    document_title:source.document_title,is_demo:source.is_demo,is_synthetic:source.is_synthetic,
    production_blocked:source.production_blocked,confidence_tier:source.confidence_tier})
    .from(source).where(eq(source.source_type,"methodology_document")),
  ]);
  return {methodologies,versions,criteria,reports,sources};
}
export type MethodologyAdminData = Awaited<ReturnType<typeof readMethodologies>>;
