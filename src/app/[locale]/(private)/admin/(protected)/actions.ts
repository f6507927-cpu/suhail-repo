"use server";
import { withAdminAction } from "../../../../../lib/auth/actions";
import { mutateRole, mutateSettings } from "../../../../../lib/auth/admin-mutations";
import { actionError, type ActionResult } from "../../../../../lib/auth/errors";
import type { Role } from "../../../../../lib/auth/guards";
import { revalidatePublic } from "@/security/revalidate-public";
export async function changeRole(targetId:string,role:Role,note:string):Promise<ActionResult> {
  try { await withAdminAction(["admin"],(tx,user)=>mutateRole(tx,user,targetId,role,note),"exclusive");return {ok:true}; }
  catch(error) {return actionError(error);}
}
export async function saveSettings(defaultId:string|null,allow:boolean):Promise<ActionResult> {
  try {const publicImpact=await withAdminAction(["admin"],(tx,user)=>mutateSettings(tx,user,defaultId,allow));if(publicImpact) revalidatePublic("settings");return {ok:true};}
  catch(error) {return actionError(error);}
}
