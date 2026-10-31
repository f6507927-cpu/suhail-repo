"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { withAdminAction } from "@/lib/auth/actions";
import * as service from "@/lib/methodology/service";
import { actionError } from "@/lib/auth/errors";
import { EngineInputError } from "@/engine";
import type { MethodologyCommand, MethodologyActionResult } from "@/lib/methodology/commands";
import { revalidatePublic } from "@/security/revalidate-public";
import { methodologyAffectsPublic } from "@/security/public-impact";
export async function methodologyAction(command:MethodologyCommand):Promise<MethodologyActionResult> {
  await requireRole(["admin"]);
  try {
    let publicImpact = false;
    const result=await withAdminAction(["admin"],async(tx,user):Promise<MethodologyActionResult>=>{
      publicImpact = await methodologyAffectsPublic(tx, command);
      switch(command.operation) {
        case "metadata":return {ok:true,id:await service.saveMethodology(tx,user,command.id,command.data)};
        case "version":return {ok:true,id:await service.saveVersion(tx,user,command.methodologyId,command.id,command.cloneId,command.data)};
        case "criterion":return {ok:true,id:await service.saveCriterion(tx,user,command.versionId,command.id,command.data)};
        case "deleteCriterion":await service.deleteCriterion(tx,user,command.versionId,command.id);return {ok:true};
        case "cases":await service.saveCases(tx,user,command.versionId,command.data);return {ok:true};
        case "source":await service.associateSource(tx,user,command.versionId,command.sourceId);return {ok:true};
        case "visibility":await service.setVisibility(tx,user,command.versionId,command.isPublic);return {ok:true};
        case "transition":return service.transition(tx,user,command.versionId,command.target,command.note);
        case "production":await service.enableProduction(tx,user,command.versionId,command.note);return {ok:true};
        default:throw new service.GovernanceError("Unknown methodology operation");
      }
    });
    revalidatePath("/admin/methodologies");revalidatePath("/en/admin/methodologies");
    if (result.ok && publicImpact) revalidatePublic("methodology");
    return result;
  } catch(error) {
    if(error instanceof service.GovernanceError) return {ok:false,error:error.message};
    if(error instanceof ZodError) return {ok:false,error:error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")};
    if(error instanceof EngineInputError) return {ok:false,error:"Invalid or contradictory engine evidence. No result was produced."};
    // Only safe known SQL constraint classes; never disclose raw SQL/connection data.
    const dbError=error as {cause?:{code?:string};code?:string};
    const code=dbError.cause?.code??dbError.code;
    if(["23505","23503","23514","P0001"].includes(code??"")) return {ok:false,error:"Database refused the change: the identity may already exist, content may be finalized, or required production provenance is missing. Reload and review the record."};
    const failure=actionError(error);
    return {ok:false,error:failure.ok?"Operation failed":failure.error};
  }
}
