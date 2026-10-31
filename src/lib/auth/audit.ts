import "server-only";
import { dbApp } from "../../db/app";
import { auditEvent, users } from "../../db/schema/accounts";
export type Tx = Parameters<Parameters<typeof dbApp.transaction>[0]>[0];
export type AppUser = typeof users.$inferSelect;
export async function audit(tx: Tx, actor: Pick<AppUser,"id"|"email"|"role"> | null, event: typeof auditEvent.$inferInsert) {
  await tx.insert(auditEvent).values({...event, is_demo: false, actor_id: actor?.id ?? null, actor_email: actor?.email ?? null, actor_role: actor?.role ?? null, occurred_at: new Date()});
}
// D-76: policy versions belong on users, never copied into id-only audit metadata.
export function userAudit(tx: Tx, id: string, event_type: "user_registered" | "consent_recorded") {
  return audit(tx, null, {event_type, entity_name: "users", entity_id: id, summary: event_type});
}
