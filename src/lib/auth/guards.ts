import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { dbApp } from "../../db/app";
import { users } from "../../db/schema/accounts";
import { serverAuth } from "./server";
import { AuthError } from "./errors";
import { currentConsent } from "./policies";
import { localePath, safeNext } from "./paths";
export type Role = "user" | "editor" | "admin";
export const verifiedIdentity = cache(async () => {
  try {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new AuthError(401,"sign_in_required");
  const auth = await serverAuth();
  // D-47: the cookie supplies only the token, never authoritative user/factors.
  // Bind assurance to exactly the token verified below, not an SDK refresh or
  // the no-argument assurance helper's cookie session.
  const session = await auth.auth.getSession();
  const accessToken = session.data.session?.access_token;
  if (session.error || !accessToken) throw new AuthError(401, "sign_in_required");
  const {data, error} = await auth.auth.getUser(accessToken);
  if (error || !data.user) throw new AuthError(401, "sign_in_required");
  let currentLevel: "aal1" | "aal2";
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part) || part.length % 4 === 1))
      throw new Error("Malformed token");
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (claims.sub !== data.user.id || (claims.aal !== "aal1" && claims.aal !== "aal2"))
      throw new Error("Invalid assurance");
    currentLevel = claims.aal;
    if (data.user.factors !== undefined && !Array.isArray(data.user.factors))
      throw new Error("Invalid factors");
    if (data.user.factors?.some(factor => !factor || !["verified", "unverified"].includes(factor.status)))
      throw new Error("Invalid factor status");
  } catch {
    throw new AuthError(401, "sign_in_required");
  }
  const nextLevel = data.user.factors?.some(factor => factor.status === "verified") ? "aal2" : currentLevel;
  const hasVerifiedTotp = data.user.factors?.some(factor =>
    factor.factor_type === "totp" && factor.status === "verified") ?? false;
  return {auth, identity: data.user, currentLevel, nextLevel, hasVerifiedTotp};
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(401, "sign_in_required");
  }
});
const cachedUser = cache(async (consent: boolean) => {
  const verified = await verifiedIdentity();
  const [user] = await dbApp.select().from(users).where(eq(users.id, verified.identity.id));
  if (!user) throw new AuthError(401, "recovery_required");
  if (consent && !currentConsent(user)) throw new AuthError(403, "consent_required");
  return {...verified, user};
});
// React cache keys compare argument identity. Normalize fresh options/role
// allocations to primitives; never use a process-global authentication cache.
export function requireUser(options: {consent?: boolean} = {}) {
  return cachedUser(options.consent !== false);
}
export async function requireMfaBootstrap() {
  const context = await requireUser();
  if (context.user.role === "user") throw new AuthError(403, "role_required");
  return context;
}
const cachedRole = cache(async (roleKey: string) => {
  const context = await requireUser();
  const roles = roleKey.split(",");
  if (!roles.includes(context.user.role) || context.user.role === "user") throw new AuthError(403, "role_required");
  // D-47: AAL2 alone is not sufficient if TOTP was removed or another factor
  // supplied that assurance. Enrollment must still be authoritative and TOTP.
  if (!context.hasVerifiedTotp) throw new AuthError(403, "mfa_enroll_required");
  if (context.currentLevel === "aal2") return context;
  if (context.nextLevel === "aal2") throw new AuthError(403, "mfa_verify_required");
  throw new AuthError(403, "mfa_enroll_required");
});
export function requireRole(roles: readonly Role[] = ["admin", "editor"]) {
  return cachedRole([...new Set(roles)].sort().join(","));
}
async function pageGuard<T>(locale: string, next: string, check: () => Promise<T>): Promise<T> {
  try { return await check(); } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    const destinations: Record<string,string> = {
      sign_in_required: "/auth/sign-in", recovery_required: "/auth/recover",
      consent_required: "/auth/consent", mfa_enroll_required: "/admin/mfa/enroll", mfa_verify_required: "/admin/mfa/verify",
    };
    const destination = destinations[error.code];
    if (destination) redirect(`${localePath(locale, destination)}?next=${encodeURIComponent(safeNext(next) ?? localePath(locale, "/"))}`);
    // A real 403 page rather than giving ordinary users an MFA bootstrap.
    const { forbidden } = await import("next/navigation");
    return forbidden();
  }
}
export async function requirePageUser(locale: string, next: string) {
  return pageGuard(locale, safeNext((await headers()).get("x-private-path"))??next, () => requireUser());
}
export async function requirePageRole(locale: string, next: string, roles: readonly Role[] = ["admin", "editor"]) {
  return pageGuard(locale, safeNext((await headers()).get("x-private-path"))??next, () => requireRole(roles));
}
export function requireMfaUser(locale: string, next: string) {
  return pageGuard(locale, next, requireMfaBootstrap);
}
export function requireConsentUser(locale: string, next: string) {
  return pageGuard(locale,next,()=>requireUser({consent:false}));
}
