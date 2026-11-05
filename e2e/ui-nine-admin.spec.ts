import { test,expect,type Page } from "@playwright/test";
async function ready(page:Page,path:string){await page.goto(path);await expect(page.locator("h1").first()).toBeVisible();}
async function noOverflow(page:Page){
  const sizes=await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,left:document.body.getBoundingClientRect().left}));
  expect(sizes.doc).toBeLessThanOrEqual(sizes.width+1);expect(sizes.body).toBeLessThanOrEqual(sizes.width+1);expect(sizes.left).toBeGreaterThanOrEqual(-1);
}
for(const width of [375,1366]) test.describe(`${width}px isolated admin fixtures`,()=>{
  test.use({viewport:{width,height:width===375?812:768}});
  for(const section of ["methodologies","securities","ingestion","settings","audit","users","editions","analysts","runs/fixture"])
    test(`${section} has no sideways page scroll`,async({page})=>{await ready(page,`/admin/${section}`);await noOverflow(page);
      for(const detail of await page.locator("details").all()) await detail.evaluate((element:HTMLDetailsElement)=>{element.open=true;});
      await noOverflow(page);
    });
  test("finds a stock locally and opens only company details",async({page})=>{
    await ready(page,"/admin/securities");
    expect(await page.locator("[data-selected-security]").count()).toBe(0);
    expect(await page.locator("[data-security-row]").allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining("ALP"),expect.stringContaining("MID"),expect.stringContaining("ZED")]));
    const search=page.getByRole("searchbox");
    await search.fill("ZED");await expect(page.locator("[data-security-row]")).toHaveCount(1);
    await search.fill("شركة زد");await expect(page.locator("[data-security-row]")).toHaveCount(1);
    await page.locator("[data-security-row]").click();
    await expect(page.locator("[data-admin-record-section]")).toHaveCount(7);
    await expect(page.locator("[data-admin-record-section][open]")).toHaveAttribute("data-admin-record-section","Company details");
    if(width===375){await expect(page.locator("[data-security-list]")).toBeHidden();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThan(2500);}
    await page.locator('[data-admin-record-section="Screening"] > summary').click();
    await expect(page.getByRole("combobox")).toHaveValue("version-default");
    await expect(page.getByRole("combobox").locator("option:checked")).toHaveText(/^1\.1.*الافتراضي/);
    for(const detail of await page.locator("[data-admin-record-section]").all()) await detail.evaluate((element:HTMLDetailsElement)=>{element.open=true;});
    await expect(page.locator("[data-selected-security]")).not.toContainText("تسمية غير معروفة");
    await expect(page.locator("[data-selected-security]")).toContainText("Unmapped analyst measure");
    await noOverflow(page);
    if(width===375){await page.getByRole("button",{name:"العودة إلى القائمة"}).click();await expect(search).toHaveValue("شركة زد");}
  });
  test("requires bulk confirmation, cancellation makes no call, and shows actual versions",async({page})=>{
    await ready(page,"/admin/ingestion");
    for(const kind of ["screen","ingest"]){
      await page.locator(`[data-bulk-kind="${kind}"] button`).click();
      await expect(page.getByRole("dialog")).toContainText("3");
      if(kind==="screen"){await expect(page.getByRole("dialog")).toContainText("1.0");await expect(page.getByRole("dialog")).toContainText("1.1");}
      await page.getByRole("dialog").getByRole("button",{name:"إلغاء"}).click();
      expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("screening-fixture-calls")??"[]"))).toHaveLength(0);
    }
    await page.locator('[data-bulk-kind="screen"] button').click();
    await page.getByRole("dialog").getByRole("button",{name:"تشغيل",exact:true}).click();
    expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("screening-fixture-calls")??"[]"))).toEqual([{action:"runUniverseAction",args:["screen",null]}]);
    await expect(page.locator("[data-job-history]")).toContainText("Fixture filing could not be fetched.");
    await expect(page.locator("[data-job-history]").getByRole("button",{name:"استئناف",exact:true})).toBeVisible();
  });
  test("settings preserve missing saved selections and hide other examples",async({page})=>{
    await ready(page,"/admin/settings?missing=1");
    await expect(page.locator('option[value="example"]')).toHaveCount(0);
    await expect(page.locator('option[value="saved-not-in-picker"]')).toBeAttached();
    await page.getByRole("searchbox").fill("ZED");
    await expect(page.locator('option[value="nasdaq-zed"]')).toBeAttached();
    await expect(page.locator('option[value="nasdaq-alp"]')).toHaveCount(0);
    await page.getByRole("searchbox").fill("Zed Systems");
    await expect(page.locator('option[value="nasdaq-zed"]')).toBeAttached();
    await ready(page,"/admin/settings?example=1");
    await expect(page.locator('option[value="example"]')).toContainText("(مثال)");
    await ready(page,"/admin/settings?featured=1");
    await page.getByRole("searchbox").fill("ZED");
    await expect(page.locator("select").nth(1)).toHaveValue("nasdaq-alp");
    await expect(page.locator('option[value="nasdaq-alp"]')).toContainText("ALP");
  });
  test("new bulk starts disable for a running job without blocking existing resume",async({page})=>{
    await ready(page,"/admin/ingestion?running=1");
    await expect(page.locator('[data-bulk-kind="screen"] button')).toBeDisabled();
    await expect(page.locator('[data-bulk-kind="ingest"] button')).toBeDisabled();
    await expect(page.locator("[data-job-history]").getByRole("button",{name:"استئناف",exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("screening-fixture-calls")??"[]"))).toHaveLength(0);
  });
  test("mobile menu and audit filters are native disclosures",async({page})=>{
    await ready(page,"/admin/audit");
    await expect(page.locator("main").first()).toContainText("4 نوفمبر 2026");
    const filters=page.locator("details").filter({has:page.locator("form")});
    if(width===375){await expect(filters).not.toHaveAttribute("open");await filters.locator("summary").click();}
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
    await expect(page.locator("select")).toHaveCount(2);
    await noOverflow(page);
    if(width===375){const menu=page.getByText("قائمة الإدارة",{exact:false}).first();await menu.click();await expect(page.locator('nav a[href="/admin/analysts"]')).toHaveCount(0);}
  });
});
