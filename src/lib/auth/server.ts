import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getAuthEnv } from "../../env/auth";
import { AuthError } from "./errors";
import { googleOAuthUrl } from "./oauth-url";
export async function requireGoogleProvider() {
  const env = getAuthEnv();
  const base = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
  googleOAuthUrl(`${base}/auth/v1/authorize?provider=google`, env.NEXT_PUBLIC_SUPABASE_URL);
  // Public auth settings only; no privileged key or provider configuration writes.
  const response = await fetch(`${base}/auth/v1/settings`, {
    headers: {apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY},
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new AuthError(502,"provider_unavailable");
  const settings: {external?: {google?: boolean}} = await response.json();
  if (settings.external?.google !== true) throw new AuthError(502,"provider_unavailable");
}
export async function serverAuth() {
  const env = getAuthEnv();
  const store = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Server Components cannot write cookies; the private proxy refreshes.
        for (const {name, value, options} of values) {
          try { store.set(name, value, options); } catch (error) {
            if (!(error instanceof Error) || !error.message.includes("Cookies can only be modified")) throw error;
          }
        }
      },
    },
  });
}
