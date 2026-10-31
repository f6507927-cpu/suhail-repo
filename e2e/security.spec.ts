import { expect, test } from "@playwright/test";
import { securityHeaders } from "../src/security/headers";
test("legal drafts render in both locales without provider or database access", async ({ page }) => {
  for (const locale of ["ar", "en"]) for (const kind of ["terms", "privacy"]) {
    const response = await page.goto(`${locale === "en" ? "/en" : ""}/${kind}`);
    expect(response?.status()).toBe(200);
    expect(response!.headers()["www-authenticate"]).toBeUndefined();
    expect(response!.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.getByText(locale === "ar" ? "مسودة — قيد المراجعة القانونية" : "Draft — under legal review", { exact: true })).toBeVisible();
    await expect(page.locator("main")).toContainText("draft-2026-10-11");
    await expect(page.locator("article")).toContainText("⟦LEGAL-REVIEW⟧");
    await expect(page.locator("article h2")).toHaveCount(12);
    await expect(page.locator("article")).toContainText("[CONFIRM:");
    await expect(page.locator("article")).not.toContainText("Open questions for the lawyer");
    await expect(page.locator("article")).not.toContainText("أسئلة مفتوحة للمحامي");
    if (kind === "privacy") {
      await expect(page.locator("article table tr")).toHaveCount(4);
      await expect(page.locator("article table")).toContainText("[SUPABASE REGION]");
    }
  }
});
test("preview response classes preserve security through redirects and errors", async ({ request }) => {
  for (const [path, status] of [
    ["/ar", 307], ["/not-a-real-preview-route", 404],
    ["/_next/static/chunks/nonexistent-legal-fixture.js", 404],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(status);
    expect(response.headers()["www-authenticate"], path).toBeUndefined();
    expect(response.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
    expect(response.headers()["cache-control"], path).toContain("no-store");
    expect(response.headers()["content-security-policy"], path).toContain("object-src 'none'");
    for (const [key, value] of Object.entries(securityHeaders))
      expect(response.headers()[key.toLowerCase()], path).toBe(value);
  }
});
test("served production Next chunks retain immutable caching in preview", async ({ request }) => {
  const page = await request.get("/en");
  const html = await page.text();
  const path = html.match(/(?:src|href)="([^"]*\/_next\/static\/[^"]+\.(?:js|css))"/)?.[1];
  expect(path).toBeTruthy();
  const chunk = await request.get(path!);
  expect(chunk.status()).toBe(200);
  expect(chunk.headers()["cache-control"]).toContain("public");
  expect(chunk.headers()["cache-control"]).toContain("immutable");
  expect(chunk.headers()["cache-control"]).toMatch(/max-age=[1-9]\d*/);
  expect(chunk.headers()["cdn-cache-control"] ?? "").not.toContain("no-store");
  expect(chunk.headers()["cloudflare-cdn-cache-control"] ?? "").not.toContain("no-store");
  expect(chunk.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const missing = await request.get("/_next/static/chunks/nonexistent-review-fixture.js");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"] ?? "").not.toContain("immutable");
});
test("fifteen actual page views with one identity do not prevent signing in", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "192.0.2.81" });
  for (let i = 0; i < 15; i++) {
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    await expect(page.locator('a[href*="/auth/sign-in"]').first()).toBeVisible();
  }
  const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith("/auth/sign-in") && r.status() === 200);
  await page.locator('a[href*="/auth/sign-in"]').first().click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/en\/auth\/sign-in/);
});
test("marked auth/search prefetch leaves ordinary capacities intact", async ({ request }) => {
  for (const [path, capacity, ip] of [["/en/auth/sign-in", 10, "192.0.2.82"], ["/en/search", 30, "192.0.2.83"]] as const) {
    const headers = { "x-forwarded-for": ip };
    for (let i = 0; i < 40; i++) {
      expect((await request.get(path, { headers: { ...headers, "next-router-prefetch": "1" }, maxRedirects: 0 })).status()).not.toBe(429);
    }
    for (let i = 0; i < capacity; i++) {
      expect((await request.get(path, { headers, maxRedirects: 0 })).status()).not.toBe(429);
    }
    expect((await request.get(path, { headers, maxRedirects: 0 })).status()).toBe(429);
  }
});
test("production preview does not require Basic Auth and health never needs database/config",async({request})=>{
  for (const path of ["/","/en","/robots.txt","/manifest.webmanifest","/theme-restore.js","/favicon.ico"]) {
    const response = await request.get(path,{maxRedirects:0});
    expect(path === "/favicon.ico" ? [200,404] : [200,307,308],path).toContain(response.status());
    expect(response.headers()["www-authenticate"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toContain("no-store");
    for (const [key,value] of Object.entries(securityHeaders)) expect(response.headers()[key.toLowerCase()],path).toBe(value);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
  for (const path of ["/api/health","/brand/app-icon.svg","/icons/icon-32.png"]) {
    const response=await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
});
test("open preview keeps public fixed CSP, private nonce, cookies and OAuth cancellation redirect",async({request,page})=>{
  const headers={"x-forwarded-for":"192.0.2.50"};
  const publicResponse=await request.get("/",{headers});
  expect(publicResponse.status()).toBe(200);
  expect(publicResponse.headers()["content-security-policy"]).toContain("'unsafe-inline'");
  expect(publicResponse.headers()["set-cookie"]).toBeUndefined();
  expect(publicResponse.headers()["cache-control"]).toContain("no-store");
  const wrong=await request.get("/",{headers:{authorization:"Basic eDp5"}});
  expect(wrong.status()).toBe(200);
  expect(wrong.headers()["www-authenticate"]).toBeUndefined();
  await page.setExtraHTTPHeaders(headers);
  const response=await page.goto("/en/auth/sign-in");
  expect(response?.status()).toBe(200);
  const csp=response!.headers()["content-security-policy"];
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("https://accounts.google.com");
  const nonce=/'nonce-([^']+)'/.exec(csp)![1];
  expect(await page.locator("script").evaluateAll(nodes=>nodes.every(node=>!!node.nonce))).toBe(true);
  expect(await page.locator("script").evaluateAll(nodes=>nodes.map(node=>node.nonce))).toEqual(expect.arrayContaining([nonce]));
  for (const [key,value] of Object.entries(securityHeaders)) expect(response!.headers()[key.toLowerCase()]).toBe(value);
  const callback=await request.get("/en/auth/callback?error=access_denied",{headers,maxRedirects:0});
  expect(callback.status()).toBe(303);
  expect(callback.headers()["location"]).toContain("/en/auth/sign-in?error=cancelled");
  expect(callback.headers()["content-security-policy"]).toContain("nonce-");
  const robots=await request.get("/robots.txt",{headers});
  expect(await robots.text()).toContain("Disallow: /");
});
test("production limiter shares locales, aliases, methods and last-forwarded identities without leaking caches",async({request})=>{
  const paths=["/search","/en/search","/ar/search","/search/","/%65n/%73earch"];
  for(let i=0;i<30;i++){
    const response=await request.fetch(`${paths[i%paths.length]}?q=%20&_rsc=synthetic`,{
      method:i%2?"HEAD":"GET",maxRedirects:0,
      headers:{"x-forwarded-for":`198.51.100.${i}, 192.0.2.60`},
    });
    expect(response.status()).not.toBe(429);
  }
  const blocked=await request.get("/en/search?q=",{headers:{"x-forwarded-for":"192.0.2.60"},maxRedirects:0});
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect(blocked.headers()["cache-control"]).toContain("no-store");
  expect(blocked.headers()["cdn-cache-control"]).toBe("no-store");
  expect(await blocked.text()).toContain("You have exceeded the request limit.");
  const other=await request.get("/search",{headers:{"x-forwarded-for":"192.0.2.61"}});
  expect(other.status()).toBe(200);
  await new Promise(resolve=>setTimeout(resolve,2100));
  const refilled=await request.get("/search",{headers:{"x-forwarded-for":"192.0.2.60"}});
  expect(refilled.status()).toBe(200);
});
test("production auth/API budgets are path-shared, independent and health remains unconditional",async({request})=>{
  const headers={"x-forwarded-for":"192.0.2.70"};
  for(let i=0;i<10;i++){
    const response=await request.get(i%2?"/en/auth/start":"/auth/start",{headers,maxRedirects:0});
    expect(response.status()).not.toBe(429);
  }
  expect((await request.get("/en/auth/callback?error=denied",{headers,maxRedirects:0})).status()).toBe(429);
  for(let i=0;i<20;i++){
    const response=await request.get(`/api/missing-security-${i}`,{headers,maxRedirects:0});
    expect(response.status()).not.toBe(429);
  }
  const denied=await request.get("/api/account/profile",{headers,maxRedirects:0});
  expect(denied.status()).toBe(429);
  expect(denied.headers()["retry-after"]).toMatch(/^[1-9]\d*$/);
  const health=await request.get("/api/health",{headers:{"x-forwarded-for":"192.0.2.70"}});
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({status:"ok"});
  expect((await request.get("/search",{headers})).status()).toBe(200);
});
