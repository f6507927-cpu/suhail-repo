import { state, wait } from "./state";

export function installTransport() {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const s = state();
    s.calls.push(new URL(url).pathname);
    await wait();
    if (url.endsWith("/auth/v1/user")) {
      s.verifiedTokens.push(new Headers(init?.headers).get("Authorization")?.replace(/^Bearer /, "") ?? "");
      return Response.json(s.rejectProvider ? { message: "Rejected fixture token" } : {
        id: s.id, aud: "authenticated", app_metadata: {}, user_metadata: {},
        created_at: "2026-01-01T00:00:00Z", factors: s.factors,
      }, { status: s.rejectProvider ? 401 : 200 });
    }
    throw new Error(`Unexpected fixture transport: ${new URL(url).pathname}`);
  };
}
