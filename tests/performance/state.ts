import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "@supabase/supabase-js";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../../src/lib/auth/policies";

export type State = {
  id: string; role: "admin" | "editor" | "user"; aal: unknown;
  consent: boolean; factors: User["factors"]; cookieFactors?: User["factors"];
  calls: string[]; lookups: number; queries: string[]; locks: number; rechecks: number;
  active: number; maxActive: number; sessionReads: number; verifiedTokens: string[];
  rejectProvider?: boolean; missingToken?: boolean; token?: string;
  cancelLock?: boolean; commits: number; rollbacks: number;
};
export const requests = new AsyncLocalStorage<State>();
export function state() {
  const value = requests.getStore();
  if (!value) throw new Error("Fixture request missing");
  return value;
}
export function scenario(overrides: Partial<State> = {}): State {
  return {
    id: "00000000-0000-4000-8000-000000000001", role: "admin", aal: "aal2",
    consent: true, factors: [{ id: "fixture-factor", factor_type: "totp", status: "verified",
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
    calls: [], lookups: 0, queries: [], locks: 0, rechecks: 0,
    active: 0, maxActive: 0, sessionReads: 0, verifiedTokens: [],
    commits: 0, rollbacks: 0, ...overrides,
  };
}
export function user() {
  const s = state();
  return {
    id: s.id, role: s.role, full_name: "Fixture Admin", email: null,
    terms_version: s.consent ? CURRENT_TERMS_VERSION : "old",
    privacy_version: CURRENT_PRIVACY_VERSION,
    accepted_at: new Date("2026-01-01T00:00:00Z"),
  };
}
export const latency = 15;
export const wait = () => new Promise(resolve => setTimeout(resolve, latency));
export function token() {
  const s = state();
  if (s.token !== undefined) return s.token;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: s.id, aud: "authenticated", role: "authenticated", aal: s.aal,
    iat: Math.floor(Date.now() / 1000) - 60, exp: Math.floor(Date.now() / 1000) + 3600,
  })}.${encode("fixture-signature")}`;
}
export function cookies() {
  const s = state();
  const session = {
    access_token: s.missingToken ? "" : token(), refresh_token: "fixture-refresh",
    token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600, user: { id: s.id, aud: "authenticated", app_metadata: {},
      user_metadata: {}, created_at: "2026-01-01T00:00:00Z",
      factors: s.cookieFactors ?? s.factors },
  };
  return [{ name: "sb-auth-auth-token",
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }];
}
