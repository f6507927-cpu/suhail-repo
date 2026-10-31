import { afterEach, expect, it, vi } from "vitest";
import { approvedAsset } from "../src/security/preview";
import { categoryFor, clientIdentity, TokenBuckets } from "../src/security/rate-limit";
import { runtimeLog } from "../src/security/logger";
import { publicCsp, secureResponse, securityHeaders } from "../src/security/headers";
afterEach(() => {vi.unstubAllEnvs(); vi.restoreAllMocks();});
it("preserves immutable Next static caching, but not document or other asset caching, in preview", () => {
  const cached = () => new Response("chunk", { headers: { "Cache-Control": "public, max-age=31536000, immutable" } });
  const chunk = secureResponse(cached(), true, true);
  expect(chunk.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect(chunk.headers.get("cdn-cache-control")).toBeNull();
  expect(chunk.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(secureResponse(cached(), true).headers.get("cache-control")).toContain("no-store");
  expect(secureResponse(new Response("failed", { status: 503 }), true, true).headers.get("cache-control")).toContain("no-store");
});
it("allows encoded Next chunk names without allowing encoded traversal or arbitrary routes", () => {
  for (const path of ["/_next/static/chunks/%5Broot%5D.css", "/_next/static/chunks/package_%40swc.js"]) {
    expect(approvedAsset(path)).toBe(true);
  }
  for (const path of ["/_next/static/%2e%2e/admin", "/_next/static/%2fadmin", "/_next/static/%255broot.js", "/_next/static/../admin", "/_next/static/a\\b", "/admin/file.js"]) {
    expect(approvedAsset(path)).toBe(false);
  }
});
it.each(["/search","/en/search","/ar/search/","/%65n/%73earch","/%2565n/search","//en//search","/en/x/../search"])("shares routing aliases: %s", path => {
  expect(categoryFor(path)).toBe("search");
});
it("shares auth/API paths and validates only the trimmed last forwarded entry", () => {
  expect(categoryFor("/en/auth/callback")).toBe("auth");
  expect(categoryFor("/auth/start")).toBe("auth");
  expect(categoryFor("/api/account/profile")).toBe("api");
  expect(clientIdentity("spoofed, 192.0.2.1 ")).toBe("192.0.2.1");
  for (const value of [null, "", "192.0.2.1,", "192.0.2.1, invalid", "192.0.2.1:80"]) expect(clientIdentity(value)).toBe("unknown");
  expect(clientIdentity("2001:0db8:0:0:0:0:0:1")).toBe(clientIdentity("2001:db8::1"));
});
it("unknown identities share budgets per category without consuming other categories",()=>{
  const buckets=new TokenBuckets();
  for(let i=0;i<10;i++) buckets.take("auth",clientIdentity(null),0);
  expect(buckets.take("auth",clientIdentity("192.0.2.1, invalid"),0).allowed).toBe(false);
  expect(buckets.take("api",clientIdentity(null),0).allowed).toBe(true);
  expect(buckets.take("search",clientIdentity(null),0).allowed).toBe(true);
});
it.each([["search",30,2000],["auth",10,6000],["api",20,1000]] as const)("enforces %s burst and continuous refill", (category,capacity,refill) => {
  const buckets = new TokenBuckets();
  for(let i=0;i<capacity;i++) expect(buckets.take(category,"client",0).allowed).toBe(true);
  expect(buckets.take(category,"client",0)).toEqual({allowed:false,retryAfter:refill/1000});
  expect(buckets.take(category,"client",refill-1).allowed).toBe(false);
  expect(buckets.take(category,"client",refill).allowed).toBe(true);
  expect(buckets.take(category,"other",refill).allowed).toBe(true);
});
it("cannot refresh a budget by flooding the bounded map with new identities", () => {
  const buckets = new TokenBuckets(1);
  for(let i=0;i<30;i++) buckets.take("search","first",0);
  for(let i=0;i<30;i++) buckets.take("search",`attacker${i}`,0);
  expect(buckets.take("search","first",0).allowed).toBe(false);
  expect(buckets.take("search","new",0).allowed).toBe(false);
  expect(buckets.take("search","new",60_000).allowed).toBe(true);
});
it("safe structured logging cannot serialize arbitrary errors, cookies, tokens, requests or values", () => {
  const sink = vi.spyOn(console,"error").mockImplementation(()=>{});
  runtimeLog("action_failed", {status:500,category:"Bearer secret",error:new Error("secret"),authorization:"secret",cookie:"secret",body:"secret"} as never);
  expect(sink).toHaveBeenCalledWith('{"event":"action_failed","status":500}');
  runtimeLog("secret" as never);
  expect(sink).toHaveBeenCalledTimes(1);
});
it("applies the exact global headers and a production fixed policy without nonce or dev allowances", () => {
  const response = secureResponse(new Response(),true);
  for (const [key,value] of Object.entries(securityHeaders)) expect(response.headers.get(key)).toBe(value);
  const csp = publicCsp("https://fixture.supabase.co/auth/path",false);
  expect(csp).toContain("connect-src 'self' https://fixture.supabase.co");
  expect(csp).toContain("form-action 'self' https://fixture.supabase.co https://accounts.google.com");
  for (const forbidden of ["nonce-","unsafe-eval"," ws:"," wss:"]) expect(csp).not.toContain(forbidden);
});
