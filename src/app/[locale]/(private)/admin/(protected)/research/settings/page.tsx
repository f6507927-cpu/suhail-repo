import { eq } from "drizzle-orm";
import { dbApp } from "@/db/app";
import { researchSetting } from "@/db/schema/research";
import { ResearchSettings } from "@/components/research";
import { requirePageRole } from "@/lib/auth/guards";
import { localePath } from "@/lib/auth/paths";
import { saveResearchSettings, changeResearchGate } from "@/lib/research/actions";
import { privatePageMetadata } from "@/components/accounts/private-page-metadata";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return privatePageMetadata((await params).locale, "Research settings");
}
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale === "en" ? "en" : "ar";
  await requirePageRole(locale, localePath(locale, "/admin/research/settings"), ["admin"]);
  const [settings] = await dbApp.select().from(researchSetting).where(eq(researchSetting.id, 1));
  if (!settings) throw new Error("Research settings unavailable; migration 0023 must be applied by the operator");
  return <ResearchSettings locale={locale} settings={{ ...settings, price_move_threshold_percent:
    settings.price_move_threshold_percent === null ? null : Number(settings.price_move_threshold_percent) }}
    saveAction={saveResearchSettings} gateAction={changeResearchGate} />;
}
