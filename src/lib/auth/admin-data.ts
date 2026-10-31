import "server-only";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { requireRole } from "./guards";
import { dbApp } from "../../db/app";
import { users, auditEvent, auditEventType } from "../../db/schema/accounts";
import { editorialSetting } from "../../db/schema/editorial";
import { methodologyVersion } from "../../db/schema/methodology";
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
  return {rows,page,total};
}
export async function readSettings() {
  await requireRole(["admin"]);
  const [settings]=await dbApp.select().from(editorialSetting).where(eq(editorialSetting.setting_key,"editorial"));
  const versions=await dbApp.select({id:methodologyVersion.id,version_label:methodologyVersion.version_label}).from(methodologyVersion).where(eq(methodologyVersion.is_public,true));
  return {settings:settings??null,versions:versions.map(v=>({...v,version_label:v.version_label??v.id}))};
}
