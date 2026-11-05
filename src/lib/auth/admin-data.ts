import "server-only";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { requireRole } from "./guards";
import { dbApp } from "../../db/app";
import { users, auditEvent, auditEventType } from "../../db/schema/accounts";
import { editorialSetting } from "../../db/schema/editorial";
import { methodology, methodologyVersion } from "../../db/schema/methodology";
import { company, security } from "../../db/schema/market";
import { AuthError } from "./errors";
function pageNumber(page: unknown) {
  const n = Number(page ?? 1);
  if(!Number.isSafeInteger(n)||n<1||n>100000) throw new AuthError(400,"invalid_page");
  return n;
}
export async function searchUsers(query="", requestedPage=1) {
  await requireRole(["admin"]);
  const page=pageNumber(requestedPage);
  if(query.length>200) throw new AuthError(400,"invalid_search");
  const term = `%${query.replace(/[\\%_]/g,"\\$&")}%`;
  const where=query?or(ilike(users.email,term),ilike(users.full_name,term)):undefined;
  const rows = await dbApp.select().from(users).where(where).orderBy(desc(users.created_at),users.id).limit(25).offset((page-1)*25);
  const [{total}] = await dbApp.select({total:count()}).from(users).where(where);
  const status = rows.length ? await dbApp.execute<{user_id:string;verified_totp:boolean}>(sql`select * from app.verified_totp_status(ARRAY[${sql.join(rows.map(r=>sql`${r.id}::uuid`),sql`, `)}]::uuid[])`) : [];
  const factors = new Map(status.map(r=>[r.user_id,r.verified_totp]));
  return {rows:rows.map(r=>({...r,verified_totp:factors.get(r.id)??false})),page,total};
}
export async function readAudit(filters:{event?:string;entity?:string;from?:string;to?:string;page?:number}={}) {
  await requireRole(["admin"]);
  const page=pageNumber(filters.page);
  if(filters.event && !auditEventType.enumValues.includes(filters.event as typeof auditEventType.enumValues[number])) throw new AuthError(400,"invalid_event");
  const date=(value:string|undefined,end:boolean) => {
    if(!value) return undefined;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new AuthError(400,"invalid_date");
    return new Date(`${value}T${end?"23:59:59.999":"00:00:00.000"}Z`);
  };
  const from=date(filters.from,false),to=date(filters.to,true);
  const where=and(filters.event?eq(auditEvent.event_type,filters.event as typeof auditEventType.enumValues[number]):undefined,filters.entity?eq(auditEvent.entity_name,filters.entity):undefined,from?gte(auditEvent.occurred_at,from):undefined,to?lte(auditEvent.occurred_at,to):undefined);
  const rows=await dbApp.select().from(auditEvent).where(where).orderBy(desc(auditEvent.occurred_at),auditEvent.id).limit(25).offset((page-1)*25);
  const [{total}]=await dbApp.select({total:count()}).from(auditEvent).where(where);
  // D-167: entities are stored text, not a DB enum. Populate the UI from existing
  // audited values without narrowing the existing filter or changing audit writes.
  const entities = await dbApp.selectDistinct({entity:auditEvent.entity_name}).from(auditEvent);
  return {rows,page,total,eventOptions:[...auditEventType.enumValues],entityOptions:entities.map(row=>row.entity).filter((value):value is string=>Boolean(value)).sort()};
}
export async function readSettings() {
  await requireRole(["admin"]);
  const [settings]=await dbApp.select().from(editorialSetting).where(eq(editorialSetting.setting_key,"editorial"));
  const versions=await dbApp.select({id:methodologyVersion.id,version_label:methodologyVersion.version_label,version:methodologyVersion.version,
    versionDemo:methodologyVersion.is_demo,versionBlocked:methodologyVersion.production_blocked,methodDemo:methodology.is_demo,
    methodBlocked:methodology.production_blocked,methodSource:methodology.official_or_inspired}).from(methodologyVersion)
    .innerJoin(methodology,eq(methodology.id,methodologyVersion.methodology_id)).where(settings?.default_shariah_methodology_version_id
      ? or(eq(methodologyVersion.is_public,true),eq(methodologyVersion.id,settings.default_shariah_methodology_version_id)) : eq(methodologyVersion.is_public,true));
  const [featured] = settings?.featured_security_id ? await dbApp.select({slug:security.slug})
    .from(security).where(eq(security.id,settings.featured_security_id)).limit(1) : [];
  const selectedStocks = await dbApp.select({slug:security.slug,ticker:security.ticker,name:company.name,display_name_en:company.display_name_en,name_ar:company.name_ar})
    .from(security).innerJoin(company,eq(company.id,security.company_id)).where(eq(security.in_universe,true));
  return {settings:settings?{...settings,featured_security_slug:featured?.slug??null}:null,
    versions:versions.map(v=>({id:v.id,version:v.version,version_label:v.version_label??v.version,
      isExample:v.versionDemo||v.versionBlocked||v.methodDemo||v.methodBlocked||v.methodSource==="internal_example"})),
    securities:selectedStocks.map(stock=>({slug:stock.slug,ticker:stock.ticker,name:stock.display_name_en||stock.name,nameAr:stock.name_ar})).sort((a,b)=>a.ticker.localeCompare(b.ticker,"en"))};
}
