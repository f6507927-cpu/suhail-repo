import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({localize:vi.fn(), create:vi.fn()}));
vi.mock("next-intl/middleware",()=>({default:()=>mocks.localize}));
vi.mock("@supabase/ssr",()=>({createServerClient:mocks.create}));
import proxy from "../src/proxy";
import { securityHeaders } from "../src/security/headers";
beforeEach(() => {
  vi.stubEnv("SITE_MODE","preview");
  vi.stubEnv("PREVIEW_BASIC_AUTH_USER",undefined);
  vi.stubEnv("PREVIEW_BASIC_AUTH_PASSWORD",undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL",undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY",undefined);
  mocks.localize.mockReset().mockImplementation(()=>NextResponse.next());
  mocks.create.mockReset();
});
afterEach(()=>vi.unstubAllEnvs());
it.each(["/en/search", "/ar/auth/sign-in"])("prefetch does not consume the ordinary budget: %s", async path => {
  const category = path.includes("search") ? "search" : "auth";
  const capacity = category === "search" ? 30 : 10;
  const headers = { "x-forwarded-for": `192.0.2.${category === "search" ? 211 : 212}` };
  for (let i = 0; i < 40; i++) {
    expect((await proxy(new NextRequest(`https://fixture.test${path}`, { headers: { ...headers, "next-router-prefetch": "1" } }))).status).toBe(200);
  }
  for (let i = 0; i < capacity; i++) {
    expect((await proxy(new NextRequest(`https://fixture.test${path}`, { headers }))).status).toBe(200);
  }
  expect((await proxy(new NextRequest(`https://fixture.test${path}`, { headers }))).status).toBe(429);
});
it("API requests still consume tokens even when marked as prefetch", async () => {
  const headers = { "x-forwarded-for": "192.0.2.213", "next-router-prefetch": "1" };
  for (let i = 0; i < 20; i++) {
    expect((await proxy(new NextRequest("https://fixture.test/api/example", { headers }))).status).toBe(200);
  }
  expect((await proxy(new NextRequest("https://fixture.test/api/example", { headers }))).status).toBe(429);
});
it.each(["/","/en","/en/auth/callback?code=test","/auth/start","/account","/admin",
  "/api/account/profile","/api/health/","/robots.txt","/manifest.webmanifest","/sitemap.xml","/favicon.ico","/theme-restore.js","/_next/image?url=x","/file.json"])("does not challenge preview requests for Basic Auth: %s", async path => {
  const response = await proxy(new NextRequest(`https://fixture.test${path}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("www-authenticate")).toBeNull();
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.create).not.toHaveBeenCalled();
  for (const [key,value] of Object.entries(securityHeaders)) expect(response.headers.get(key)).toBe(value);
});
it.each(["/api/health","/_next/static/chunks/app.js","/brand/app-icon.svg","/icons/icon.png","/fonts/font.woff2"])("exempt %s remains noindex with missing credentials", async path => {
  vi.stubEnv("PREVIEW_BASIC_AUTH_USER",undefined);
  const response = await proxy(new NextRequest(`https://fixture.test${path}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.localize).not.toHaveBeenCalled();
});
it("APIs/metadata pass through without Basic Auth or next-intl page rewriting", async () => {
  for (const path of ["/api/account/profile","/robots.txt","/manifest.webmanifest"]) {
    const response = await proxy(new NextRequest(`https://fixture.test${path}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  }
  expect(mocks.localize).not.toHaveBeenCalled();
});
it("callback retains nonce propagation and refresh cookies without Basic Auth", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://auth.fixture.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","synthetic");
  mocks.create.mockImplementation((_url,_key,options)=>({auth:{getUser:async()=>{
    options.cookies.setAll([{name:"pkce-fixture",value:"fresh",options:{httpOnly:true,sameSite:"lax"}}]);
  }}}));
  mocks.localize.mockImplementation(()=>NextResponse.redirect("https://fixture.test/auth/callback"));
  const response = await proxy(new NextRequest("https://fixture.test/en/auth/callback?code=synthetic"));
  expect(response.status).toBe(307);
  expect(response.cookies.get("pkce-fixture")?.value).toBe("fresh");
  expect(response.headers.get("content-security-policy")).toContain("strict-dynamic");
  expect(response.headers.get("x-middleware-request-x-private-path")).toBe("/en/auth/callback?code=synthetic");
});
it("proxy failures are generic, secured and uncached", async () => {
  mocks.localize.mockImplementation(()=>{throw new Error("sensitive detail")});
  const response = await proxy(new NextRequest("https://fixture.test/en"));
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("sensitive");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
});
it("preview redirects retain security, robots and no-store", async () => {
  mocks.localize.mockImplementation(() => NextResponse.redirect("https://fixture.test/en"));
  const response = await proxy(new NextRequest("https://fixture.test/en/"));
  expect(response.status).toBe(307);
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
});
it("hashed static responses keep immutable caching and preview indexing protection", async () => {
  const response = await proxy(new NextRequest("https://fixture.test/_next/static/chunks/fixture.js"));
  // The proxy must not override the immutable cache header Next supplies later.
  expect(response.headers.has("cache-control")).toBe(false);
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
  expect(response.headers.get("www-authenticate")).toBeNull();
});
