import { requireUser } from "../../../../lib/auth/guards";
import { privateJson, httpError } from "../../../../lib/auth/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const {user} = await requireUser({consent:false});
    return privateJson({id:user.id,full_name:user.full_name,role:user.role});
  } catch (error) { return httpError(error); }
}
