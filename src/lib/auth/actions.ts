import "server-only";
import { eq, sql } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { users } from "../../db/schema/accounts";
import { requireUser, requireRole, type Role } from "./guards";
import { type Tx } from "./audit";
import { AuthError } from "./errors";
import { currentConsent } from "./policies";
// D-135: ordinary actions coexist; role changes exclude all role-checked writes.
export async function withAdminAction<T>(roles: readonly Role[], work: (tx: Tx, user: typeof users.$inferSelect) => Promise<T>, lock: "shared" | "exclusive" = "shared") {
  const verified = await requireRole(roles);
  return dbApp.transaction(async tx => {
    await tx.execute(lock === "exclusive"
      ? sql`select pg_advisory_xact_lock(73501947)`
      : sql`select pg_advisory_xact_lock_shared(73501947)`);
    const [user] = await tx.select().from(users).where(eq(users.id, verified.identity.id));
    if (!user || !roles.includes(user.role)) {
      throw new AuthError(403, "role_required");
    }
    return work(tx, user);
  });
}
export async function withUserAction<T>(work: (tx: Tx, user: typeof users.$inferSelect) => Promise<T>) {
  const verified = await requireUser();
  return dbApp.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(73501947)`);
    const [user] = await tx.select().from(users).where(eq(users.id, verified.identity.id)).for("update");
    if (!user) {
      throw new AuthError(401, "recovery_required");
    }
    if (!currentConsent(user)) {
      throw new AuthError(403,"consent_required");
    }
    return work(tx, user);
  });
}
