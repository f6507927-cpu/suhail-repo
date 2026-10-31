import "server-only";
import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { dbApp } from "../../db/app";
import { users } from "../../db/schema/accounts";
import { userAudit } from "./audit";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "./policies";
// Insert ON CONFLICT serializes competing callbacks; only the inserting transaction audits.
export async function registerIdentity(identity: User, locale: "ar"|"en", initialConsent: boolean) {
  return dbApp.transaction(async tx => {
    const profile = {
      email: identity.email ?? null,
      full_name: typeof identity.user_metadata.full_name === "string" ? identity.user_metadata.full_name : "",
      last_sign_in_at: new Date(),
    };
    const [inserted] = await tx.insert(users).values({
      id: identity.id, ...profile, role: "user", locale_pref: locale,
      terms_version: initialConsent ? CURRENT_TERMS_VERSION : null,
      privacy_version: initialConsent ? CURRENT_PRIVACY_VERSION : null,
      accepted_at: initialConsent ? new Date() : null,
    }).onConflictDoNothing({target: users.id}).returning();
    if (inserted) {
      await userAudit(tx, identity.id, "user_registered");
      if (initialConsent) await userAudit(tx, identity.id, "consent_recorded");
      return inserted;
    }
    const [existing] = await tx.update(users).set(profile).where(eq(users.id, identity.id)).returning();
    return existing;
  });
}
