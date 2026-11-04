import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach,describe,expect,it,vi } from "vitest";
import { AuthError } from "../src/lib/auth/errors";
import { normalizedStockRequest } from "../src/lib/stock-request-input";
import { stockRequestsArabic } from "../src/i18n/approved-arabic-stock-requests";
import { reviewText } from "../src/components/accounts/types";
import { safeNext } from "../src/lib/auth/paths";
import { categoryFor } from "../src/security/rate-limit";
const boundary=vi.hoisted(()=>({guard:vi.fn(),create:vi.fn(),remove:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("../src/lib/auth/guards",()=>({requireRole:boundary.guard}));
vi.mock("../src/lib/stock-requests",()=>({createStockRequest:boundary.create,removeStockRequest:boundary.remove}));
vi.mock("../src/lib/auth/origin",()=>({authOrigin:()=> "https://fixture.test"}));
import { POST,DELETE } from "../src/app/api/stock-requests/route";
import { StockRequestAction } from "../src/components/search/StockRequestAction";
import { AccountStockRequests } from "../src/components/accounts/AccountStockRequests";
function request(body:unknown,method="POST",origin="https://fixture.test") {
  return new Request("https://fixture.test/api/stock-requests",{
    method,headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body),
  });
}
beforeEach(()=>{
  boundary.guard.mockReset().mockResolvedValue({user:{id:"fixture-user"}});
  boundary.create.mockReset().mockResolvedValue("created");
  boundary.remove.mockReset().mockResolvedValue(undefined);
});
describe("stock request input and approved copy",()=>{
  it.each([[null,null],[{},null],["",null],["  ",null],["x".repeat(41),null],["\0",null],["َ",null],["  AAPL  ","aapl"],["أَمـل","امل"]])("normalizes %j",(input,expected)=>{
    expect(normalizedStockRequest(input)).toBe(expected);
  });
  it("keeps every exact founder-approved translation through the normal approval mechanism",()=>{
    for(const [en,ar] of Object.entries(stockRequestsArabic)){
      // Bidi controls may be inserted by the central presentation mechanism.
      expect(reviewText("ar",en).replace(/[\u2066-\u2069]/g,"")).toBe(ar);
      expect(reviewText("en",en)).toBe(en);
    }
  });
  it("preserves encoded search returns without accepting encoded route delimiters",()=>{
    for(const path of ["/search?q=not%20covered","/en/search?q=%D8%B3%D9%87%D9%85"]){
      expect(safeNext(path)).toBe(path);
    }
    for(const path of ["/%2Fsearch?q=test","/search%3Fq=test","/search?q=x&next=%2Faccount","/search?q="+ "%61".repeat(41),"/account?next=%2F%2Fevil.test","/auth/sign-in?next=%2Fsearch"]){
      expect(safeNext(path)).toBeNull();
    }
  });
  it("belongs to the existing D-136 API budget",()=>expect(categoryFor("/api/stock-requests")).toBe("api"));
});
describe("guarded private request route",()=>{
  it("rejects signed-out callers before validation or persistence",async()=>{
    boundary.guard.mockRejectedValue(new AuthError(401,"sign_in_required"));
    const result=await POST(request({query:"zzzz"}));
    expect(result.status).toBe(401);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it.each([["created",201],["already_requested",200],["limit_reached",409]])("returns %s without echoing identity/query",async(status,code)=>{
    boundary.create.mockResolvedValue(status);
    const result=await POST(request({query:"  ZZZZ "}));
    expect(result.status).toBe(code);
    expect(await result.json()).toEqual({status});
    expect(boundary.guard).toHaveBeenCalledWith(["user","editor","admin"],{scope:"account"});
    expect(boundary.create).toHaveBeenCalledWith("zzzz");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("x-robots-tag")).toContain("noindex");
  });
  it.each([{},null,{query:[]},{query:""},{query:"x".repeat(41)},{query:"zzzz",user_id:"another-account"},{query:"\0"}])("rejects invalid JSON shape %j",async body=>{
    const result=await POST(request(body));
    expect(result.status).toBe(400);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("bounds streamed request bodies",async()=>{
    const result=await POST(request({query:"x".repeat(2000)}));
    expect(result.status).toBe(400);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and cross-site writes",async()=>{
    expect((await POST(new Request("https://fixture.test/api/stock-requests",{method:"POST",headers:{Origin:"https://fixture.test"},body:"{"}))).status).toBe(400);
    expect((await POST(request({query:"zzzz"},"POST","https://evil.test"))).status).toBe(403);
    expect(boundary.create).not.toHaveBeenCalled();
  });
  it("returns an opaque error without logging body or database diagnostics",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    boundary.create.mockRejectedValue(new Error("query-containing internal failure"));
    const result=await POST(request({query:"private-query"}));
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({error:"operation_failed"});
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("removes only through a guarded same-origin JSON write",async()=>{
    const result=await DELETE(request({query:"ZZZZ"},"DELETE"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({status:"removed"});
    expect(boundary.remove).toHaveBeenCalledWith("zzzz");
    boundary.guard.mockRejectedValue(new AuthError(401,"sign_in_required"));
    expect((await DELETE(request({query:"zzzz"},"DELETE"))).status).toBe(401);
  });
});
describe("progressively enhanced request presentation",()=>{
  it("server renders a signed-out CTA preserving the same search, without a server session read",()=>{
    const html=renderToStaticMarkup(<StockRequestAction locale="ar" query="Not covered"/>);
    expect(html).toContain("سجّل الدخول لطلب هذا السهم");
    expect(html).toContain(encodeURIComponent("/search?q=Not%20covered"));
    expect(html).not.toContain("⟦AR-REVIEW⟧");
  });
  it("renders only the supplied own-query/date rows and approved empty state",()=>{
    const html=renderToStaticMarkup(<AccountStockRequests locale="ar" requests={[{normalized_query:"zzzz",created_at:"2026-11-04T12:00:00.000Z"}]}/>);
    expect(html).toContain("طلباتك");
    expect(html).toContain("<bdi");
    expect(html).toContain("zzzz");
    expect(html).toContain("إزالة");
    expect(html).not.toContain("⟦AR-REVIEW⟧");
    expect(renderToStaticMarkup(<AccountStockRequests locale="en" requests={[]}/>)).toContain("You haven&#x27;t requested any stocks yet.");
  });
});
