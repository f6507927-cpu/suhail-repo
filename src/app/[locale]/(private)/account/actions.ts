"use server";
import { eq, sql } from "drizzle-orm";
import { users } from "../../../../db/schema/accounts";
import { withUserAction } from "../../../../lib/auth/actions";
import { serverAuth } from "../../../../lib/auth/server";
import { actionError, AuthError, type ActionResult } from "../../../../lib/auth/errors";
export async function updateLocale(locale: "ar"|"en"): Promise<ActionResult> {
  try {
    await withUserAction(async (tx,user) => {
      if(locale!=="ar" && locale!=="en") throw new AuthError(400,"invalid_locale");
      await tx.update(users).set({locale_pref:locale}).where(eq(users.id,user.id));
    });
    return {ok:true};
  } catch(error) {return actionError(error);}
}
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  try {
    await withUserAction(async (tx,user) => {
      if (confirmation!=="DELETE") throw new AuthError(400,"confirmation_required");
      if (user.role !== "user") throw new AuthError(403,"ask_another_admin_to_remove_role");
      // D-50: ID comes ONLY from verified session. SQL already inserts one deletion event.
      await tx.execute(sql`select app.delete_own_account(${user.id}::uuid)`);
    });
    const auth = await serverAuth();
    const {error} = await auth.auth.signOut();
    if (error) return {ok:false,error:"account_deleted_sign_out_failed",status:500};
    return {ok:true};
  } catch(error) {return actionError(error);}
}
