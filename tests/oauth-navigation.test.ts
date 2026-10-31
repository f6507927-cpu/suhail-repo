import { beforeEach, afterEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({ oauth: vi.fn(), setCookie: vi.fn(), getUser: vi.fn(), exchange: vi.fn(), provider: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: boundary.setCookie }) }));
vi.mock("../src/lib/auth/server", () => ({ requireGoogleProvider: boundary.provider, serverAuth: boundary.client }));
vi.mock("../src/lib/auth/registration", () => ({ registerIdentity: vi.fn() }));
import { POST } from "../src/app/[locale]/(private)/auth/start/route";
import { GET } from "../src/app/[locale]/(private)/auth/callback/route";
import { authOrigin } from "../src/lib/auth/origin";
import { sameOriginPost } from "../src/lib/auth/http";
import { googleOAuthUrl } from "../src/lib/auth/oauth-url";
import { privateCsp } from "../src/lib/auth/csp";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://site.test");
  vi.stubEnv("REPLIT_DEV_DOMAIN", "preview.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth.fixture.test");
  boundary.setCookie.mockReset();
  boundary.provider.mockReset().mockResolvedValue(undefined);
  boundary.oauth.mockReset().mockResolvedValue({ data: {url: "https://auth.fixture.test/auth/v1/authorize?provider=google"}, error: null });
  boundary.client.mockReset().mockResolvedValue({auth:{
    signInWithOAuth:boundary.oauth, getUser:boundary.getUser, exchangeCodeForSession:boundary.exchange,
  }});
  boundary.getUser.mockResolvedValue({ data: {user: null}, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function post(origin = "https://site.test", next = "/en/account") {
  return new Request("http://0.0.0.0:5000/en/auth/start", {method: "POST", headers: {origin}, body: new URLSearchParams({next})});
}
it.each(["ar", "en"])("starts %s OAuth with external callback, safe next, private JSON and secure consent", async locale => {
  const response = await POST(post(), {params: Promise.resolve({locale})});
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({url: "https://auth.fixture.test/auth/v1/authorize?provider=google"});
  expect(boundary.oauth).toHaveBeenCalledWith({provider:"google", options:{
    redirectTo:`https://site.test${locale === "en" ? "/en" : ""}/auth/callback?next=%2Fen%2Faccount`,
    skipBrowserRedirect: true,
  }});
  expect(boundary.setCookie).toHaveBeenCalledWith("suhail-consent","1",expect.objectContaining({httpOnly:true, secure:true, sameSite:"lax", maxAge:600}));
  expect(console.error).not.toHaveBeenCalled();
});
it("uses the exact configured preview origin behind the proxy, ignoring forwarded headers", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const request = post("https://preview.test", "//evil.test");
  request.headers.set("x-forwarded-host","evil.test");
  request.headers.set("x-forwarded-proto","http");
  expect(authOrigin(request)).toBe("https://preview.test");
  const response = await POST(request, {params:Promise.resolve({locale:"ar"})});
  expect(response.status).toBe(200);
  expect(boundary.oauth.mock.calls[0][0].options.redirectTo).toBe("https://preview.test/auth/callback");
});
it.each(["https://evil.test", "https://site.test.evil.test", "null", "http://site.test", "https://preview.test"])("rejects malicious or production-preview Origin %s before OAuth or consent", async origin => {
  const response = await POST(post(origin), {params:Promise.resolve({locale:"en"})});
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({error:"invalid_origin"});
  expect(boundary.oauth).not.toHaveBeenCalled();
  expect(boundary.setCookie).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
});
it.each([
  ["provider_check", () => boundary.provider.mockRejectedValue(new Error("SECRET_FIXTURE provider payload"))],
  ["session_client", () => boundary.client.mockRejectedValue(new Error("SECRET_FIXTURE key"))],
  ["oauth_request", () => boundary.oauth.mockRejectedValue(new Error("SECRET_FIXTURE token"))],
  ["consent_cookie", () => boundary.setCookie.mockImplementation(() => { throw new Error("SECRET_FIXTURE cookie"); })],
] as const)("logs only a safe stage for an unexpected %s failure", async (stage, fail) => {
  fail();
  const response = await POST(post(), {params:Promise.resolve({locale:"en"})});
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({error:"operation_failed"});
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage,reason:"unexpected",
  }));
});
it("identifies destination validation without recording the returned provider URL", async () => {
  boundary.oauth.mockResolvedValue({data:{url:"https://evil.test/auth/v1/authorize?provider=google&token=SECRET_FIXTURE"},error:null});
  const response = await POST(post(), {params:Promise.resolve({locale:"ar"})});
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({error:"operation_failed"});
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage:"destination_check",reason:"invalid_destination",
  }));
});
it("marks form parsing failures without logging the form or request headers", async () => {
  const request = new Request("https://site.test/auth/start", {method:"POST",headers:{
    origin:"https://site.test", "content-type":"application/json",cookie:"SECRET_FIXTURE",
  },body:'{"token":"SECRET_FIXTURE"}'});
  const response = await POST(request, {params:Promise.resolve({locale:"ar"})});
  expect(response.status).toBe(500);
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage:"form_read",reason:"unexpected",
  }));
  expect(boundary.provider).not.toHaveBeenCalled();
});
it("rejects missing Origin and fails closed when canonical origin is missing", () => {
  const request = post();
  request.headers.delete("origin");
  expect(() => sameOriginPost(request)).toThrow();
  vi.stubEnv("SITE_URL", "");
  expect(() => authOrigin(post())).toThrow();
});
it("accepts only same-port local aliases when Next normalizes a development request", () => {
  vi.stubEnv("NODE_ENV","development");
  const request = new Request("http://localhost:3100/auth/start", {method:"POST",headers:{origin:"http://127.0.0.1:3100"}});
  expect(authOrigin(request)).toBe("http://127.0.0.1:3100");
  expect(() => sameOriginPost(request)).not.toThrow();
  request.headers.set("origin","http://127.0.0.1:9999");
  expect(() => sameOriginPost(request)).toThrow();
});
it("does not trust arbitrary request or forwarded host for callback failures", async () => {
  const request = new Request("https://evil.test/en/auth/callback?error=denied", {headers:{"x-forwarded-host":"evil.test"}});
  const response = await GET(request, {params:Promise.resolve({locale:"en"})});
  expect(response.headers.get("location")).toBe("https://site.test/en/auth/sign-in?error=cancelled");
});
it("recovers callback cancellation on the externally reachable preview origin", async () => {
  vi.stubEnv("NODE_ENV","development");
  const response = await GET(new Request("http://0.0.0.0:5000/auth/callback?error=denied"), {params:Promise.resolve({locale:"ar"})});
  expect(response.headers.get("location")).toBe("https://preview.test/auth/sign-in?error=cancelled");
});
it("returns a private failure, with no consent cookie, for provider errors", async () => {
  boundary.oauth.mockResolvedValue({data:{url:null},error:new Error("provider disabled")});
  const response = await POST(post(), {params:Promise.resolve({locale:"en"})});
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({error:"oauth_start_failed"});
  expect(boundary.setCookie).not.toHaveBeenCalled();
});
it("fails before OAuth and consent when provider settings are unavailable", async () => {
  boundary.provider.mockRejectedValue(new Error("provider unavailable"));
  const response = await POST(post(), {params:Promise.resolve({locale:"en"})});
  expect(response.status).toBe(500);
  expect(boundary.oauth).not.toHaveBeenCalled();
  expect(boundary.setCookie).not.toHaveBeenCalled();
});
it.each([
  "https://evil.test/auth/v1/authorize?provider=google",
  "https://auth.fixture.test.evil.test/auth/v1/authorize?provider=google",
  "https://user@auth.fixture.test/auth/v1/authorize?provider=google",
  "http://auth.fixture.test/auth/v1/authorize?provider=google",
  "https://auth.fixture.test/other?provider=google",
  "https://auth.fixture.test/auth/v1/authorize?provider=github",
  "https://auth.fixture.test/auth/v1/authorize?provider=google&provider=github",
  "javascript:alert(1)",
])("refuses unsafe OAuth destination %s server-side and client-side", async url => {
  expect(() => googleOAuthUrl(url,"https://auth.fixture.test")).toThrow();
  boundary.oauth.mockResolvedValue({data:{url},error:null});
  const response = await POST(post(), {params:Promise.resolve({locale:"en"})});
  expect(response.status).toBe(500);
  expect(boundary.setCookie).not.toHaveBeenCalled();
});
it("retains strict CSP nonces, same-origin form actions and frame protections", () => {
  const csp = privateCsp("testnonce","https://auth.fixture.test",false);
  expect(csp).toContain("script-src 'self' 'nonce-testnonce' 'strict-dynamic'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("*");
});
