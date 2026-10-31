import { spawn } from "node:child_process";
// Actual production build; no copied auth code or application bypass.
// Strip inherited provider/database settings before starting Next.
const env = {...process.env};
for (const key of Object.keys(env)) {
  if (/^(DATABASE_URL|PG|SUPABASE_|NEXT_PUBLIC_SUPABASE_|SESSION_SECRET|PREVIEW_BASIC_AUTH_)/.test(key)) delete env[key];
}
Object.assign(env,{
  PORT:"3600", SITE_MODE:"preview", SITE_URL:"https://security.fixture.test",
});
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next","start","-H","0.0.0.0","-p","3600"],{env,stdio:"inherit"});
for (const signal of ["SIGINT","SIGTERM"] as const) process.once(signal,()=>child.kill(signal));
child.once("exit",code=>{process.exitCode=code ?? 1});
