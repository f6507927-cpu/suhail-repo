import { createServerClient as original } from "@supabase/ssr";
import { state } from "./state";

// Count calls without replacing SDK behavior. Outbound fetch is the sole
// provider-response boundary; cookies and returned users remain independent.
export function createServerClient(...args: Parameters<typeof original>) {
  const client = original(...args);
  const getSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = (...parameters) => {
    state().sessionReads++;
    return getSession(...parameters);
  };
  return client;
}
