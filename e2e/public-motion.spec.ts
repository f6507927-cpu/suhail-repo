import { expect,test } from "@playwright/test";

// Live dev canaries complement the separately isolated, populated fixture suite.
// Do not let an error document count as a successful overflow/motion check.
for(const width of [375,768,1440]){
  test(`UX-7: successful public pages do not overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for(const prefix of ["","/en"]){
      for(const route of ["/","/search?q=AAPL","/stock/nasdaq-aapl"]){
        const response=await page.goto(`${prefix}${route}`);
        expect(response?.status(),`${prefix}${route} must render successfully before checking UX-7`).toBe(200);
        await expect(page.locator("[data-public-ux] main")).toBeVisible();
        await page.evaluate(()=>document.fonts.ready);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
    }
  });
}
