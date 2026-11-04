import { test, expect } from "@playwright/test";
import { checkRegister } from "../src/lib/copy-register";

const fixtures=[
  ["demo-fixa","passes_selected_methodology",true,true],
  ["demo-fixb","requires_review",false,false],
  ["demo-fixc","fails_selected_methodology",false,false],
  ["demo-fixd","insufficient_data",false,false],
  ["demo-fixu","passes_selected_methodology",false,false],
  ["demo-covered-no-profile","passes_selected_methodology",true,false],
] as const;
for(const locale of ["ar","en"] as const) {
  test(`UX-5 ${locale}: all statuses, covered profiles and §13.3 public checks`,async({page,request})=>{
    await page.setViewportSize({width:375,height:900});
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    const prefix=locale==="ar"?"":"/en";
    await page.goto(prefix||"/");
    for(const [slug,status,seal,byline] of fixtures) {
      const path=`${prefix}/stock/${slug}`;
      // §13.3 1/2/3: actual Next dev HTML, not a component-only mock.
      const response=await request.get(path);
      expect(response.status()).toBe(200);
      const html=await response.text();
      expect(html).toContain('lang="'+locale+'"');
      expect(html).toContain(`dir="${locale==="ar"?"rtl":"ltr"}"`);
      expect(html).toContain("Fixture");
      expect(html).toContain("2025");
      for(const tag of ["og:title","og:description","og:image","twitter:card"])expect(html).toContain(tag);
      expect(html).toMatch(/href[Ll]ang="ar"/);
      expect(html).toMatch(/href[Ll]ang="en"/);
      expect(html).toContain('name="robots" content="noindex, nofollow"');
      await page.goto(path);
      const answer=page.locator('[data-section="why"]');
      const badge=answer.locator('.status-pass,.status-fail,.status-review,.status-insufficient').first();
      await expect(badge).toBeVisible();
      await expect(badge.locator("svg")).toBeVisible();
      await expect(answer.locator('[class*="reasonBlock"]')).toBeVisible();
      await expect(answer.locator('[class*="meaningBlock"]')).toBeVisible();
      await expect(page.locator('[data-section="search-again"] input[type="search"]')).toBeVisible();
      await expect(page.locator("[data-coverage-seal]")).toHaveCount(seal?1:0);
      await expect(page.locator("[data-coverage-byline]")).toHaveCount(byline?1:0);
      await expect(page.locator("body")).not.toContainText("Inactive synthetic analyst");
      await expect(page.locator("body")).not.toContainText("Analyst profile unavailable");
      const record=page.locator('details[data-section="full-record"]');
      await expect(record).not.toHaveAttribute("open");
      // Complete evidence remains in raw SSR HTML even while hidden.
      expect(html).toContain('data-section="metadata"');
      expect(html).toContain('data-section="fundamentals"');
      expect(html).toContain('data-section="sources"');
      expect(html).toContain('data-section="disclaimer"');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      // §13.3 6a: real computed font, spacing and icon/text status presentation.
      expect(await page.locator("body").evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/Plex/i);
      const reason=answer.locator('[class*="reasonBlock"] li').first();
      if(await reason.count()) {
        const ratio=await reason.evaluate(el=>parseFloat(getComputedStyle(el).lineHeight)/parseFloat(getComputedStyle(el).fontSize));
        expect(ratio).toBeGreaterThanOrEqual(locale==="ar"?1.8:1.5);
      }
      // §13.3 6b: result colors only on the status/criteria; figures use neutral ink.
      if(status==="passes_selected_methodology") {
        expect(await badge.evaluate(el=>getComputedStyle(el).backgroundColor)).toMatch(/rgb\((46, 125, 91|63, 171, 124)\)/);
      }
      const figures=page.locator('[class*="factValue"]');
      for(const figure of await figures.all()) {
        expect(await figure.evaluate(el=>getComputedStyle(el).color)).not.toMatch(/rgb\((46, 125, 91|63, 171, 124|179, 70, 47|217, 129, 110)\)/);
      }
      // §13.3 6c: check the rendered register, including English fallbacks.
      expect(checkRegister(await page.locator("body").innerText(),locale).hardBans).toEqual([]);
      await expect(page.locator("[data-language-notice]")).toHaveCount(locale==="ar"?1:0);
      await expect(page.locator("body")).not.toContainText("⟦AR-REVIEW⟧");
      await answer.locator('details summary').first().click();
      await expect(answer).toContainText(locale==="ar"?"شرح توضيحي اختباري":"Synthetic plain criterion explanation");
      await record.locator(":scope > summary").click();
      await expect(record.locator('[data-section="metadata"]')).toBeVisible();
      const numeric=record.locator('[data-section="fundamentals"] bdi.font-mono').first();
      expect(await numeric.evaluate(el=>getComputedStyle(el).fontFamily)).toMatch(/Plex.*Mono|Mono.*Plex/i);
      await record.locator(":scope > summary").click();
    }
    // §13.3 12: home and all stock states produce no browser console errors.
    expect(errors).toEqual([]);
    await page.goto(`${prefix}/stock/demo-fixb`);
    // Do not inject caret styles into still-hydrating SSR inputs during capture.
    await page.screenshot({path:`generated-artifacts/ux-five/stock-${locale}-375.png`,fullPage:true,caret:"initial"});
    expect(errors).toEqual([]);
  });
}
test("UX-5 sharing uses the canonical URL and reports only successful copies",async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"share",{value:undefined,configurable:true});
    Object.defineProperty(navigator,"clipboard",{value:{writeText:async(text:string)=>{
      (window as unknown as {copiedUrl:string}).copiedUrl=text;
    }},configurable:true});
  });
  await page.goto("/stock/demo-fixa");
  const canonical=await page.locator('link[rel="canonical"]').getAttribute("href");
  await expect(page.getByRole("link",{name:"مشاركة عبر واتساب"})).toHaveAttribute("href",`https://wa.me/?text=${encodeURIComponent(canonical!)}`);
  await page.getByRole("button",{name:"نسخ الرابط"}).click();
  await expect(page.getByRole("status").filter({hasText:"نُسخ الرابط"})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {copiedUrl:string}).copiedUrl)).toBe(canonical);
  await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw new Error("Test denial");}},configurable:true}));
  await page.getByRole("button",{name:"نسخ الرابط"}).click();
  await expect(page.getByRole("status").filter({hasText:"حاول مرة أخرى"})).toBeVisible();
  await expect(page.getByRole("status")).not.toContainText("نُسخ الرابط");
  await page.evaluate(()=>Object.defineProperty(navigator,"share",{value:async(data:{url:string})=>{
    (window as unknown as {sharedUrl:string}).sharedUrl=data.url;
  },configurable:true}));
  await page.getByRole("button",{name:"نسخ الرابط"}).click();
  expect(await page.evaluate(()=>(window as unknown as {sharedUrl:string}).sharedUrl)).toBe(canonical);
});
