import { test,expect } from "@playwright/test";

// Isolated component/auth-boundary fixtures only; no real Google-session bypass.
test("signed-out request link returns to the same search in each locale",async({page})=>{
  for(const prefix of ["","/en"]){
    await page.goto(`${prefix}/search?screen=stock-request&q=zzzz`);
    const cta=page.getByRole("link",{name:prefix?"Sign in to request this stock":"سجّل الدخول لطلب هذا السهم"});
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(url=>url.pathname===`${prefix}/auth/sign-in` &&
      url.searchParams.get("next")===`${prefix}/search?screen=stock-request&q=zzzz`);
  }
});
test("signed-in request success is polite, disabled, and contains no identity in its API body",async({page})=>{
  let body:unknown;
  await page.route("**/api/stock-requests",async route=>{
    body=route.request().postDataJSON();
    await route.fulfill({status:201,contentType:"application/json",body:JSON.stringify({status:"created"})});
  });
  await page.goto("/search?screen=stock-request&q=zzzz");
  await page.evaluate(()=>window.fixture.session({access_token:"fixture",user:{id:"user"}}));
  await page.getByRole("button",{name:"اطلب إضافة هذا السهم"}).click();
  await expect(page.getByRole("button",{name:"سجّلنا طلبك"})).toBeDisabled();
  const feedback=page.getByRole("status").filter({hasText:"سجّلنا طلبك، وسنأخذه في الحسبان عند إضافة أسهم جديدة."});
  await expect(feedback).toHaveCount(1);
  await expect(feedback).toHaveAttribute("aria-live","polite");
  expect(body).toEqual({query:"zzzz"});
});
test("account page lists a request/date and can remove it into the approved empty state",async({page})=>{
  await page.route("**/api/stock-requests",async route=>{
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().postDataJSON()).toEqual({query:"zzzz"});
    await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"removed"})});
  });
  await page.goto("/account?requests=1");
  await expect(page.getByRole("heading",{name:"طلباتك"})).toBeVisible();
  await expect(page.locator("bdi").filter({hasText:/^zzzz$/})).toBeVisible();
  await expect(page.locator("time[datetime='2026-11-04T12:00:00.000Z']")).toBeVisible();
  await page.getByRole("button",{name:"إزالة",exact:true}).click();
  await expect(page.getByText("لم تطلب أي سهم بعد.")).toBeVisible();
  await expect(page.getByText("zzzz",{exact:true})).toHaveCount(0);
});
test("duplicate, cap and retry states use approved Arabic copy",async({page})=>{
  let result={status:500,body:{error:"operation_failed"} as Record<string,string>};
  await page.route("**/api/stock-requests",route=>route.fulfill({status:result.status,contentType:"application/json",body:JSON.stringify(result.body)}));
  for(const [status,message,name] of [
    ["already_requested","طلبت هذا السهم من قبل.","سجّلنا طلبك"],
    ["limit_reached","وصلت إلى الحد الأقصى من الطلبات (20).","اطلب إضافة هذا السهم"],
    ["error","تعذّر إرسال الطلب. حاول مرة أخرى.","اطلب إضافة هذا السهم"],
  ]){
    result=status==="error"?{status:500,body:{error:"operation_failed"}}:
      {status:status==="limit_reached"?409:200,body:{status}};
    await page.goto("/search?screen=stock-request&q=zzzz");
    await page.evaluate(()=>window.fixture.session({access_token:"fixture",user:{id:"user"}}));
    await page.getByRole("button",{name:"اطلب إضافة هذا السهم"}).click();
    await expect(page.getByText(message,{exact:true})).toBeVisible();
    if(status==="already_requested")await expect(page.getByRole("button",{name})).toBeDisabled();
  }
});
