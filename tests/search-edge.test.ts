import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import rules from "../ops/cloudflare/search-rules.json";
import { createSearchEdgeFixture, matchesSearch } from "./search-edge/fixture";

describe("disabled Cloudflare public search policy", () => {
  it("keeps the approved policy and one shared counter, without trusting client headers/cookies", () => {
    expect(rules.http_ratelimit.ratelimit).toEqual({
      characteristics: ["cf.colo.id", "ip.src"], period: 60,
      requests_per_period: 30, mitigation_timeout: 60,
    });
    expect(rules.http_ratelimit.action).toBe("block");
    expect(rules.http_ratelimit.action_parameters.response.status_code).toBe(429);
    for (const rule of Object.values(rules)) {
      expect(rule.enabled).toBe(false);
      expect(rule.expression).toBe(rules.http_ratelimit.expression);
    }
    expect(rules.http_request_cache_settings.action_parameters.cache).toBe(false);
    const body = rules.http_ratelimit.action_parameters.response.content;
    expect(body).toContain('name="robots" content="noindex, nofollow"');
    expect(body).toContain('lang="ar" dir="rtl">تجاوزت الحد المسموح من الطلبات، حاول مجددا لاحقا');
    expect(body).toContain('lang="en" dir="ltr">You have exceeded the request limit. Please try again later.');
    expect(body).not.toMatch(/<script|<link|<img|<iframe/);
  });
  it.each([
    "/search?q=FIXA", "/en/search?q=FIXB", "/search", "/search?q=",
    "/ar/search?q=FIXA", "/search/", "/en/search/", "/ar/search/",
    "/%73earch?q=x", "/en/%2573earch?_rsc=random", "/EN/search",
  ])("counts search documents and aliases regardless of query: %s", path => {
    expect(matchesSearch(`https://fixture.test${path}`)).toBe(true);
  });
  it.each([
    "/", "/en", "/stock/demo-fixa", "/en/stock/demo-fixa", "/methodology",
    "/en/methodology", "/api/health", "/searching", "/en/searching",
    "/_next/static/chunk.js", "/auth/callback", "/account",
  ])("does not affect other paths: %s", path => {
    expect(matchesSearch(`https://fixture.test${path}`)).toBe(false);
  });
  it("blocks over-budget requests before upstream, across locales, queries, HEAD and spoofed identities", async () => {
    let time = 0;
    const upstream = vi.fn(async () => new Response("SSR", { headers: { "x-origin": "preserved" } }));
    const edge = createSearchEdgeFixture(upstream, () => time);
    const req = (i: number) => new Request(`https://fixture.test${i % 2 ? "/en" : ""}/search?q=${i}&_rsc=${i}`, {
      method: i % 2 ? "HEAD" : "GET",
      headers: { "x-forwarded-for": `fake-${i}`, "cf-connecting-ip": `fake-${i}`, cookie: `fake=${i}` },
    });
    for (let i = 0; i < 30; i++) expect((await edge.handle(req(i), "trusted-ip")).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(30);
    for (const i of [30, 31]) {
      const blocked = await edge.handle(req(i), "trusted-ip");
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("cache-control")).toContain("no-store");
      expect(blocked.headers.get("x-robots-tag")).toContain("noindex");
      expect(blocked.headers.has("set-cookie")).toBe(false);
      expect(blocked.headers.has("x-origin")).toBe(false);
    }
    expect(upstream).toHaveBeenCalledTimes(30);
    time = 59_999;
    expect((await edge.handle(req(32), "trusted-ip")).status).toBe(429);
    time = 60_000;
    expect((await edge.handle(req(33), "trusted-ip")).status).toBe(200);
    expect((await edge.handle(req(34), "different-ip")).status).toBe(200);
    expect((await edge.handle(req(35), "trusted-ip", "other-colo")).status).toBe(200);
  });
  it("keeps the full block duration even when the counting window expires", async () => {
    let time = 0;
    const edge = createSearchEdgeFixture(async () => new Response("ok"), () => time);
    const req = new Request("https://fixture.test/search?q=FIXA");
    for (let i = 0; i < 30; i++) await edge.handle(req, "ip");
    time = 59_000;
    expect((await edge.handle(req, "ip")).status).toBe(429);
    time = 118_999;
    expect((await edge.handle(req, "ip")).status).toBe(429);
    time = 119_000;
    expect((await edge.handle(req, "ip")).status).toBe(200);
  });
  it("does not count unrelated routes or alter their cache headers", async () => {
    const edge = createSearchEdgeFixture(async () => new Response("ISR", {
      headers: { "cache-control": "s-maxage=900, stale-while-revalidate" },
    }));
    for (let i = 0; i < 40; i++) {
      const response = await edge.handle(new Request("https://fixture.test/en/methodology"), "ip");
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("s-maxage=900");
      expect(response.headers.has("x-robots-tag")).toBe(false);
    }
    expect((await edge.handle(new Request("https://fixture.test/search?q=FIXA"), "ip")).status).toBe(200);
  });
  it("does not introduce request cookies/headers or limiter state into public renderers", () => {
    for (const path of [
      "src/app/[locale]/(public)/search/page.tsx", "src/db/search-public.ts",
      "src/app/[locale]/(public)/page.tsx", "src/app/[locale]/(public)/stock/[slug]/page.tsx",
      "src/app/[locale]/(public)/methodology/page.tsx",
    ]) {
      expect(readFileSync(path, "utf8")).not.toMatch(/next\/headers|search-edge|cloudflare\/search-rules/);
    }
  });
});
