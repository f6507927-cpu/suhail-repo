import "server-only";
import { eq, sql } from "drizzle-orm";
import { users } from "../../db/schema/accounts";
import { editorialSetting } from "../../db/schema/editorial";
import { methodologyVersion } from "../../db/schema/methodology";
import { security } from "../../db/schema/market";
import { audit, type Tx, type AppUser } from "./audit";
import { AuthError } from "./errors";
import type { Role } from "./guards";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function mutateRole(tx:Tx, actor: AppUser, targetId:string, role:Role, note:string) {
  if (!uuid.test(targetId) || !["admin","editor","user"].includes(role) || typeof note!=="string" || !note.trim() || note.length>2000) throw new AuthError(400,"invalid_role_change");
  // Caller holds the EXCLUSIVE role-change advisory lock, including CLI grants.
  const [before] = await tx.select().from(users).where(eq(users.id,targetId)).for("update");
  if(!before) throw new AuthError(400,"user_not_found");
  if(before.role===role) return;
  if(before.role==="admin" && role!=="admin") {
    const count = await tx.execute<{n:number}>(sql`select count(*)::int n from app.users where role='admin'`);
    if(count[0].n<=1) throw new AuthError(409,"last_admin");
  }
  await tx.update(users).set({role}).where(eq(users.id,targetId));
  await audit(tx,actor,{event_type:"user_role_change",entity_name:"users",entity_id:targetId,summary:"user_role_change",details:{before:before.role,after:role,note:note.trim()}});
}
export async function mutateSettings(tx:Tx,actor:AppUser,defaultId:string|null,allow:boolean,featuredSlug?:string|null) {
  if(typeof allow!=="boolean" || (defaultId!==null && (typeof defaultId!=="string" || !uuid.test(defaultId)))) throw new AuthError(400,"invalid_settings");
  if(defaultId!==null) {
    const [version] = await tx.select().from(methodologyVersion).where(eq(methodologyVersion.id,defaultId)).for("share");
    if(!version?.is_public) throw new AuthError(400,"public_version_required");
  }
  const [before] = await tx.select().from(editorialSetting).where(eq(editorialSetting.setting_key,"editorial")).for("update");
  if(!before) throw new AuthError(409,"settings_missing");
  let featuredId = before.featured_security_id;
  if (featuredSlug !== undefined) {
    if (featuredSlug !== null && (typeof featuredSlug !== "string" || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(featuredSlug)))
      throw new AuthError(400,"invalid_featured_security");
    const [selected] = featuredSlug === null ? [] : await tx.select({
      id:security.id,in_universe:security.in_universe,listing_status:security.listing_status,
    }).from(security).where(eq(security.slug,featuredSlug)).limit(1).for("share");
    if(featuredSlug !== null && (!selected?.in_universe || selected.listing_status !== "listed"))
      throw new AuthError(400,"invalid_featured_security");
    featuredId = selected?.id ?? null;
  }
  const after = {default_shariah_methodology_version_id:defaultId,allow_ineligible_editor_pick:allow,featured_security_id:featuredId};
  // D-146: no-op submissions must not create an unaudited UPDATE.
  if(Object.keys(after).every(key=>before[key as keyof typeof after]===after[key as keyof typeof after]))return false;
  await tx.update(editorialSetting).set({...after,updated_by_email:actor.email,is_demo:false}).where(eq(editorialSetting.id,before.id));
  for (const key of ["default_shariah_methodology_version_id","allow_ineligible_editor_pick","featured_security_id"] as const) {
    if(before[key]===after[key]) continue;
    await audit(tx,actor,{event_type:"editorial_setting_change",entity_name:"editorial_setting",entity_id:before.id,summary:"editorial_setting_change",details:{key,before:before[key],after:after[key]}});
  }
  return before.default_shariah_methodology_version_id !== defaultId || before.featured_security_id !== featuredId;
}
