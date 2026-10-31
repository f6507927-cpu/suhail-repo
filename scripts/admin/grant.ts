import { cliConnection } from "../db/connection";
async function main() {
  const [email,role,...extra]=process.argv.slice(2);
  if(!email || !["admin","editor"].includes(role) || extra.length) throw new Error("Usage: pnpm admin:grant <email> <admin|editor>");
  const client=cliConnection("DATABASE_URL_MIGRATIONS");
  try {
    await client.begin(async tx=>{
      await tx`select pg_advisory_xact_lock(73501947)`;
      const matches=await tx`select id from auth.users where lower(email)=lower(${email})`;
      if(matches.length!==1) throw new Error("Expected exactly one Google-signed-in auth user");
      const [user]=await tx`select id,role from app.users where id=${matches[0].id} for update`;
      if(!user) throw new Error("Sign in to Suhail once before granting a role");
      if(user.role===role) return;
      if(user.role==="admin" && role==="editor") {
        const [{n}]=await tx`select count(*)::int n from app.users where role='admin'`;
        if(n<=1) throw new Error("Cannot demote the last admin");
      }
      await tx`update app.users set role=${role} where id=${user.id}`;
      await tx`insert into app.audit_event(event_type,entity_name,entity_id,summary,actor_email,details,is_demo)
        values('user_role_change','users',${user.id},'user_role_change','system:cli',
        ${tx.json({before:user.role,after:role,note:"workspace bootstrap"})},false)`;
    });
    console.log("Role granted; user must enroll TOTP before admin access.");
  } finally {await client.end();}
}
main().catch(()=>{console.error("Role grant failed. Check usage, existing sign-in, database configuration and last-admin protection.");process.exitCode=1;});
