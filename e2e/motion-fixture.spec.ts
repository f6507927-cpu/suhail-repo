import { expect,test } from "@playwright/test";
import { THEME_COLORS } from "../src/lib/theme-script";

for(const width of [375,768,1440])for(const locale of ["ar","en"]) {
  test(`${locale} ${width}: no horizontal scroll across public routes`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for(const route of ["/","/search?q=AAPL","/stock/nasdaq-aapl","/methodology","/terms","/privacy"]){
      const response=await page.goto(`${locale==="en"?"/en":""}${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if(route==="/methodology"){
        const href=await page.locator('main a[href*="/methodology/"]').first().getAttribute("href");
        expect(href).toBeTruthy();
        const detailResponse=await page.goto(href!);
        expect(detailResponse?.status()).toBe(200);
        await expect(page.locator("main")).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
  });
}
test("motion is once-only, staggered, compositor-only, and direction-aware",async({page})=>{
  await page.addInitScript(()=>{
    const original=Element.prototype.animate;
    const calls:{frames:unknown;delay:unknown;ratio:boolean}[]=[];
    Object.assign(window,{motionCalls:calls});
    Element.prototype.animate=function(frames,options){
      calls.push({frames,delay:typeof options==="object"?options.delay:undefined,ratio:this.hasAttribute("data-ux-ratio")});
      return original.call(this,frames,options);
    };
  });
  await page.goto("/");
  await expect.poll(()=>page.evaluate(()=>((window as unknown as {motionCalls:unknown[]}).motionCalls).length)).toBeGreaterThan(0);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.waitForTimeout(1200); // Finish the deliberate 420ms animation and its viewport stagger.
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(1200);
  const before=await page.evaluate(()=>((window as unknown as {motionCalls:unknown[]}).motionCalls).length);
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(600);
  expect(await page.evaluate(()=>((window as unknown as {motionCalls:unknown[]}).motionCalls).length)).toBe(before);
  const calls=await page.evaluate(()=>((window as unknown as {motionCalls:{frames:Record<string,unknown>[];delay:number}[]}).motionCalls));
  expect(calls.some(call=>call.delay===80)).toBe(true);
  expect(calls.every(call=>call.frames.every(frame=>Object.keys(frame).every(key=>["opacity","transform"].includes(key))))).toBe(true);
  const bar=page.locator("[data-ux-ratio]").first();
  const rtl=await bar.evaluate(element=>{const style=getComputedStyle(element);return {origin:style.transformOrigin,width:element.getBoundingClientRect().width};});
  expect(parseFloat(rtl.origin)).toBeCloseTo(rtl.width,0);
  await page.goto("/en");
  expect(parseFloat(await page.locator("[data-ux-ratio]").first().evaluate(element=>getComputedStyle(element).transformOrigin))).toBe(0);
});
test("reduced motion cancels movement and keeps content visible",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==="running").length)).toBe(0);
  const card=page.locator("a[data-ux-card]").first();await card.hover();
  expect(await card.evaluate(element=>getComputedStyle(element).transform)).toBe("none");
});
test("no JavaScript: headings, cards, ratio fills and disclaimer remain usable",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,baseURL:"http://127.0.0.1:3500"});
  const page=await context.newPage();await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("a[data-ux-card]")).toBeVisible();
  expect(await page.locator("[data-ux-ratio]").first().evaluate(element=>getComputedStyle(element).opacity)).toBe("1");
  await page.locator('footer a[href="#full-disclaimer"]').click();
  await expect(page.locator("#full-disclaimer")).toBeVisible();
  await context.close();
});
test("theme-color follows stored choice, toggles and locale document navigation",async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem("suhail-theme"))localStorage.setItem("suhail-theme","light");});
  await page.goto("/");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",THEME_COLORS.light);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole("button",{name:/theme|المظهر|السمة/i}).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",THEME_COLORS.dark);
  await page.locator("header").getByRole("link").filter({hasText:"English"}).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",THEME_COLORS.dark);
  await page.getByRole("button",{name:/theme/i}).click();
  await page.locator("header").getByRole("link").filter({hasText:"العربية"}).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content",THEME_COLORS.light);
});
test("focus rings and decorative icon semantics survive hydration",async({page})=>{
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focus=page.locator(":focus-visible");await expect(focus).toBeVisible();
  expect(await focus.evaluate(element=>getComputedStyle(element).outlineColor)).toBe("rgb(224, 188, 133)");
  expect(await page.locator("[data-public-ux] svg").evaluateAll(nodes=>nodes.every(node=>node.getAttribute("aria-hidden")==="true"||node.getAttribute("role")==="img"))).toBe(true);
  await expect(page.locator('[class*="status-"]').first()).not.toBeEmpty();
});
