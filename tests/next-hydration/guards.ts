// Copied ONLY into a generated, separate Next test project. Never imported by src.
import type * as Contract from "../../src/lib/auth/guards";
export type { Role } from "../../src/lib/auth/guards";
import { cookies } from "next/headers";
import { AuthError } from "../../src/lib/auth/errors";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../src/lib/auth/policies";

async function context() {
  const role = (await cookies()).get("hydration-session")?.value;
  if (role !== "user" && role !== "admin") throw new AuthError(401, "sign_in_required");
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      full_name: "Hydration Fixture",
      email: null,
      phone: null,
      role,
      locale_pref: "ar",
      terms_version: CURRENT_TERMS_VERSION,
      privacy_version: CURRENT_PRIVACY_VERSION,
      accepted_at: new Date("2026-10-11T22:30:00Z"),
    },
  } as Awaited<ReturnType<typeof Contract.requireUser>>;
}
export const requireUser: typeof Contract.requireUser = context;
export const requireRole: typeof Contract.requireRole = context;
export const requirePageUser: typeof Contract.requirePageUser = context;
export const requirePageRole: typeof Contract.requirePageRole = context;
export const requireMfaUser: typeof Contract.requireMfaUser = context;
export const requireMfaBootstrap: typeof Contract.requireMfaBootstrap = context;
export const requireConsentUser: typeof Contract.requireConsentUser = context;
export const verifiedIdentity: typeof Contract.verifiedIdentity = context;
