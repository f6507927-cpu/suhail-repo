import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { verifiedIdentity } from "../../../../../../lib/auth/guards";
import { registerIdentity } from "../../../../../../lib/auth/registration";
import { dbApp } from "../../../../../../db/app";
import { users } from "../../../../../../db/schema/accounts";
import { userAudit } from "../../../../../../lib/auth/audit";
import {
  currentConsent,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from "../../../../../../lib/auth/policies";
import { localePath, safeNext } from "../../../../../../lib/auth/paths";
import { sameOriginPost, httpError } from "../../../../../../lib/auth/http";
import { AuthError } from "../../../../../../lib/auth/errors";
import { authOrigin } from "../../../../../../lib/auth/origin";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  try {
    const { identity, auth } = await verifiedIdentity();
    sameOriginPost(request);
    const form = await request.formData();
    if (form.get("decision") === "decline") {
      const { error } = await auth.auth.signOut();
      if (error) throw error;
      return NextResponse.redirect(
        new URL(localePath(locale, "/"), authOrigin()),
        303,
      );
    }
    if (form.get("decision") !== "accept")
      throw new AuthError(400, "invalid_consent");
    await registerIdentity(identity, locale === "en" ? "en" : "ar", false);
    const user = await dbApp.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(users)
        .where(eq(users.id, identity.id))
        .for("update");
      if (!currentConsent(row)) {
        const [updated] = await tx
          .update(users)
          .set({
            terms_version: CURRENT_TERMS_VERSION,
            privacy_version: CURRENT_PRIVACY_VERSION,
            accepted_at: new Date(),
          })
          .where(eq(users.id, identity.id))
          .returning();
        await userAudit(tx, identity.id, "consent_recorded");
        return updated;
      }
      return row;
    });
    return NextResponse.redirect(
      new URL(
        safeNext(form.get("next")) ?? localePath(user.locale_pref, "/"),
        authOrigin(),
      ),
      303,
    );
  } catch (error) {
    return httpError(error);
  }
}
