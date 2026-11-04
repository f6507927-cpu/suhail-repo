import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { dbPublic } from "./public";
import { security, company, methodology, methodologyVersion, pick, edition, analystProfile } from "./schema";
import { loadPublicStock } from "./stock-public";
import { getSiteEnv } from "../env/site";
import { publicPortraitUrl } from "../lib/public-media";
import type { PublicHomeData } from "../home/types";

/** D-36/D-146: exactly one selected security, never an anonymous universe list. */
export async function loadPublicHome(db:typeof dbPublic=dbPublic):Promise<PublicHomeData> {
  const [setting]=await db.execute<{default_shariah_methodology_version_id:string|null;featured_security_id:string|null}>(
    sql`select default_shariah_methodology_version_id,featured_security_id from app.public_settings limit 1`);
  const versionId=setting?.default_shariah_methodology_version_id;
  const [definition]=versionId ? await db.select({
    name:methodology.name,slug:methodology.slug,version:methodologyVersion.version,
  }).from(methodologyVersion).innerJoin(methodology,eq(methodology.id,methodologyVersion.methodology_id))
    .where(and(eq(methodologyVersion.id,versionId),eq(methodologyVersion.is_public,true))).limit(1) : [];
  let featured:PublicHomeData["featured"]=null;
  if(definition && setting.featured_security_id) {
    const [selected]=await db.select({slug:security.slug}).from(security)
      .where(and(eq(security.id,setting.featured_security_id),eq(security.in_universe,true),eq(security.listing_status,"listed"))).limit(1);
    const stock=selected ? await loadPublicStock(selected.slug,db) : null;
    // A concurrent default change must never display a card for another version.
    if(stock?.run && stock.version?.id===versionId) featured=stock;
  }
  const live=getSiteEnv().SITE_MODE==="live";
  // D-02: latest published *editor* slot only. Neither draft nor AI is a fallback.
  const [research]=await db.select({
    slug:security.slug,ticker:security.ticker,company_name:company.name,display_name_en:company.display_name_en,company_name_ar:company.name_ar,
    thesis_ar:pick.editor_thesis_ar,thesis_en:pick.editor_thesis_en,published_at:edition.published_at,
    analyst_id:analystProfile.id,name_ar:analystProfile.name_ar,name_en:analystProfile.name_en,
    credentials:analystProfile.credentials,headshot_object_key:analystProfile.headshot_object_key,
  }).from(pick).innerJoin(edition,eq(edition.id,pick.edition_id))
    .innerJoin(security,eq(security.id,pick.security_id)).innerJoin(company,eq(company.id,security.company_id))
    .leftJoin(analystProfile,and(eq(analystProfile.active,true),
      eq(analystProfile.id,sql`(select analyst_id from app.public_pick_analyst where pick_id=${pick.id} limit 1)`)))
    .where(and(eq(pick.pick_type,"editor"),inArray(edition.status,live?["published_live"]:["published_live","published_demo"]),
      eq(security.in_universe,true),eq(security.listing_status,"listed"),
      live?and(eq(edition.is_demo,false),eq(pick.is_demo,false),eq(security.is_demo,false),eq(company.is_demo,false)):undefined))
    .orderBy(sql`${edition.published_at} desc nulls last`,desc(edition.id),
      sql`${pick.editor_published_at} desc nulls last`,desc(pick.created_at),desc(pick.id)).limit(1);
  return {featured,methodology:definition??null,editorPick:research?{
    slug:research.slug,ticker:research.ticker,company_name:research.display_name_en?.trim()||research.company_name,
    company_name_ar:research.company_name_ar,thesis_ar:research.thesis_ar,thesis_en:research.thesis_en,
    published_at:research.published_at?.toISOString()??null,
    analyst:research.analyst_id && research.name_ar ? {
      name_ar:research.name_ar,name_en:research.name_en,credentials:research.credentials,
      portrait_url:publicPortraitUrl(research.headshot_object_key),
    }:null,
  }:null};
}
export const getPublicHome=cache(loadPublicHome);
