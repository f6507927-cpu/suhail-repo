import { expect,test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { checkRegister } from "../src/lib/copy-register";
for(const locale of ["ar","en"] as const)for(const width of [1440,375]) {
  test(`UX-6 ${locale} ${width}: real SSR homepage, links, disclosure and layout`,async({page,request})=>{
    const errors:string[]=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
    const path=locale==="ar"?"/":"/en";
    await page.setViewportSize({width,height:1000});
    const response=await request.get(path);
    expect(response.status()).toBe(200);
    const html=await response.text();
    expect(response.headers()["content-security-policy"]).toContain("img-src 'self' data: https://media.fixture.invalid");
    expect(html).toContain(locale==="ar"?"دليلك في السوق.":"Your bearing in the market.");
    expect(html).toContain('lang="'+locale+'"');
    await page.goto(path);
    const main=page.locator("main");
    const card=main.locator('a[href$="/stock/demo-fixa"]');
    await expect(card).toBeVisible();
    await expect(card.locator("a,button,input,summary")).toHaveCount(0);
    await expect(card.locator('[role="img"]')).toHaveCount(2);
    await expect(main.getByText("Example Co.",{exact:true})).toHaveCount(3);
    await expect(page.locator('[data-home-search-examples] a')).toHaveCount(3);
    for(const example of await page.locator('[data-home-search-examples] a').all()){
      expect((await example.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(example).toHaveAttribute("href",/\/search\?q=(AAPL|NVDA|KO)$/);
    }
    await expect(page.locator("#how-we-screen > li")).toHaveCount(3);
    await expect(main).not.toContainText("⟦AR-REVIEW⟧");
    await expect(main.locator('img[class*="authorPortrait"]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(checkRegister(await page.locator("body").innerText(),locale).hardBans).toEqual([]);
    const footer=page.locator("footer");
    await expect(footer.getByRole("link",{name:locale==="ar"?"شروط الاستخدام":"Terms of Use"})).toHaveAttribute("href",`${locale==="en"?"/en":""}/terms`);
    await expect(footer.locator("#full-disclaimer")).not.toBeVisible();
    await footer.locator('a[href="#full-disclaimer"]').click();
    await expect(footer.locator("#full-disclaimer")).toBeVisible();
    await page.goto(path);
    await page.screenshot({path:`generated-artifacts/ux-six/home-${locale}-${width}.png`,fullPage:true,caret:"initial"});
    const axe=await new AxeBuilder({page}).analyze();
    expect(axe.violations.filter(issue=>["serious","critical"].includes(issue.impact??""))).toEqual([]);
    expect(errors).toEqual([]);
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${locale==="en"?"/en":""}/stock/demo-fixa$`));
  });
}
