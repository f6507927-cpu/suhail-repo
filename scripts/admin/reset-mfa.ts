import { createClient } from "@supabase/supabase-js";
import { cliConnection } from "../db/connection";
async function main() {
  // D-48: shell-only, never runtime parsing or imported by application modules.
  if(process.env.NODE_ENV==="production") throw new Error("Production reset is forbidden");
  const [email,...extra]=process.argv.slice(2);
  if(!email || extra.length) throw new Error("Usage: pnpm admin:reset-mfa <email>");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!url || !secret) throw new Error("Workspace shell auth configuration required");
  const client=cliConnection("DATABASE_URL_MIGRATIONS");
  try {
    const matches=await client`select a.id from auth.users a join app.users u on u.id=a.id where lower(a.email)=lower(${email})`;
    if(matches.length!==1) throw new Error("Expected exactly one signed-in user");
    const id=matches[0].id as string;
    const auth=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const listed=await auth.auth.admin.mfa.listFactors({userId:id});
    if(listed.error) throw new Error("Factor listing failed");
    const factors=listed.data.factors.filter(f=>f.factor_type==="totp");
    const removed:string[]=[],failed:string[]=[];
    for(const factor of factors) {
      try {
        const result=await auth.auth.admin.mfa.deleteFactor({userId:id,id:factor.id});
        (result.error?failed:removed).push(factor.id);
      } catch {failed.push(factor.id);}
    }
    // External deletion is NOT atomic with DB. Log actual partial results, never claim rollback.
    try {
      await client`insert into app.audit_event(event_type,entity_name,entity_id,summary,actor_email,details,is_demo)
        values('user_mfa_reset','users',${id},'user_mfa_reset','system:cli',
        ${client.json({removed,failed,status:failed.length?"partial_failure":"completed"})},false)`;
    } catch {
      console.error(`Remote reset attempted: ${removed.length} removed, ${failed.length} failed; audit could not be saved. Reconcile manually.`);
      process.exitCode=1;return;
    }
    console.log(`TOTP reset: ${removed.length} removed, ${failed.length} failed; audited. Google sign-in and re-enrollment required.`);
    if(failed.length) process.exitCode=1;
  } finally {await client.end();}
}
main().catch(()=>{console.error("MFA reset failed before completion. Check workspace-only configuration; no success is implied.");process.exitCode=1;});
