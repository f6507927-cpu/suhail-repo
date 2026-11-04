import { describe,expect,it } from "vitest";
import { CHECKS,parseLiveArguments,previewPosture } from "../scripts/live-check.mjs";
describe("UX-7 reference 13.3 live-check policy",()=>{
  it("retains all fifteen reference rows, explicitly superseding crawlability",()=>{
    expect(CHECKS.map(row=>row[0])).toEqual(["1","2","3","4","5","6","6a","6b","6c","7","8","9","10","11","12"]);
    expect(CHECKS.find(row=>row[0]==="4")?.[1]).toContain("D-137/D-139");
  });
  it("accepts an explicit development origin and bounded security slug",()=>{
    expect(parseLiveArguments(["--","--base","https://dev.example.test","--stock","nasdaq-aapl"]).stock).toBe("nasdaq-aapl");
    expect(()=>parseLiveArguments(["--base","https://name:password@dev.example.test"])).toThrow();
    expect(()=>parseLiveArguments(["--base","https://dev.example.test","--stock","../../private"])).toThrow();
  });
  it("requires noindex on every sampled response and robots disallow-all, never a sitemap",()=>{
    const safe={headers:new Headers({"x-robots-tag":"noindex, nofollow"})};
    expect(previewPosture([safe],"User-agent: *\nDisallow: /",404)).toBe(true);
    expect(previewPosture([safe],"User-agent: *\nDisallow: /",200)).toBe(false);
    expect(previewPosture([safe,{headers:new Headers()}],"User-agent: *\nDisallow: /",404)).toBe(false);
    expect(previewPosture([safe],"User-agent: *\nDisallow: /\nAllow: /search",404)).toBe(false);
  });
});
