import { chromium } from "@playwright/test";
import { mkdir,writeFile,readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { parseArguments,robotsDisallowsAll } from "./smoke.mjs";
import { detectSensitive } from "./scan-bundle.mjs";

export const CHECKS=[
  ["1","Server-rendered stock verdict"],["2","Arabic-first document"],["3","Stock-specific link preview"],
  ["4","Public but unindexed (D-137/D-139 overrides sitemap requirement)"],
  ["5","No anonymous internal data"],["6","Branding assets"],["6a","Palette and typography"],
  ["6b","Status-colour exclusivity"],["6c","Copy register"],["7","No old branding"],
  ["8","Security headers"],["9","No secrets in served client JavaScript"],
  ["10","Stored-run determinism"],["11","Live AI rejection / structured fallback"],["12","Console"],
];
export function parseLiveArguments(args){
  const values=args[0]==="--"?args.slice(1):args;
  const options={stock:"nasdaq-aapl",output:"generated-artifacts/ux-seven/live-check.json"};
  for(let i=0;i<values.length;i+=2){
    if(!["--base","--stock","--output"].includes(values[i])||!values[i+1])throw Error("Expected --base origin [--stock slug] [--output file]");
    options[values[i].slice(2)]=values[i+1];
  }
  options.base=parseArguments(["--base",options.base??""]);
  if(!/^[a-z0-9][a-z0-9-]{0,199}$/.test(options.stock))throw Error("Invalid stock slug");
  return options;
}
export function previewPosture(responses,robots,sitemapStatus){
  return robotsDisallowsAll(robots)&&[404,410].includes(sitemapStatus)&&responses.every(response=>{
    const tags=(response.headers.get("x-robots-tag")??"").toLowerCase();
    return tags.includes("noindex")&&tags.includes("nofollow")&&!response.headers.has("www-authenticate");
  });
}
export async function runLiveCheck(options){
  const results=new Map();
  const record=(id,pass,detail)=>results.set(id,{id,check:CHECKS.find(row=>row[0]===id)[1],status:pass?"PASS":"FAIL",detail});
  const get=async route=>{
    const response=await fetch(new URL(route,options.base),{signal:AbortSignal.timeout(45000),redirect:"manual"});
    return {response,text:await response.text()};
  };
  const [home,stock,robots,sitemap,profile,manifest]=await Promise.all([
    get("/"),get(`/stock/${options.stock}`),get("/robots.txt"),get("/sitemap.xml"),get("/api/account/profile"),get("/manifest.webmanifest"),
  ]);
  const healthy=home.response.status===200&&stock.response.status===200;
  const blocked=`Home HTTP ${home.response.status}; stock HTTP ${stock.response.status}.`;
  record("1",stock.response.status===200&&/<main\b/.test(stock.text)&&/data-section=["']verdict|data-section=["']criteria/.test(stock.text)&&/<time\b/.test(stock.text),`Stock HTTP ${stock.response.status}; requires company, verdict and date in unexecuted HTML.`);
  record("2",stock.response.status===200&&/<html\b[^>]*lang="ar"[^>]*dir="rtl"/.test(stock.text),"Arabic lang/RTL must be present on a successful stock response.");
  record("3",stock.response.status===200&&["og:title","og:description","og:image","twitter:card"].every(key=>stock.text.includes(`"${key}"`))&&stock.text.includes(options.stock),"Requires a successful stock-specific metadata response, not an error-page fallback.");
  record("4",robots.response.status===200&&previewPosture([home.response,stock.response,robots.response,sitemap.response,profile.response,manifest.response],robots.text,sitemap.response.status),`Robots HTTP ${robots.response.status}; sitemap HTTP ${sitemap.response.status}. No Basic gate, noindex/nofollow on all sampled responses, robots disallow-all; no sitemap added.`);
  // The current API inventory contains only public health and protected profile.
  // Internal workflows use guarded server actions, not invented public data APIs.
  const routes=["/api/admin/audit","/api/editorial/settings","/api/candidate-evaluations","/api/drafts","/api/approvals"];
  const absent=await Promise.all(routes.map(route=>get(route)));
  record("5",[401,403].includes(profile.response.status)&&absent.every(item=>[401,403,404].includes(item.response.status)),`Profile HTTP ${profile.response.status}; internal/list-all route probes return only 401/403/404. Server-action guards are covered separately by unit tests.`);
  const csp=home.response.headers.get("content-security-policy")??"";
  record("8",Boolean(home.response.headers.get("strict-transport-security"))&&home.response.headers.get("x-frame-options")==="DENY"&&["default-src 'self'","object-src 'none'","base-uri 'self'","frame-ancestors 'none'"].every(rule=>csp.includes(rule)),"Checked actual dev response HSTS, fixed public CSP and frame denial.");
  const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const consoleErrors=[];
  const rendered=[];
  const scripts=new Set();
  let visual=null;
  try{
    for(const route of ["/",`/stock/${options.stock}`]){
      const page=await browser.newPage();
      page.on("pageerror",()=>consoleErrors.push("uncaught page error"));
      page.on("console",message=>{if(message.type()==="error")consoleErrors.push("console error");});
      await page.goto(new URL(route,options.base).href,{waitUntil:"domcontentloaded",timeout:60000});
      rendered.push(await page.locator("body").innerText());
      for(const src of await page.locator("script[src]").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("src")))){
        if(src?.startsWith("/_next/static/"))scripts.add(src);
      }
      if(route==="/"&&healthy){
        visual=await page.evaluate(()=>{
          const p=document.querySelector("main p");
          const num=document.querySelector("main .font-mono,main .tabular-nums,main bdi");
          const style=p?getComputedStyle(p):null;
          const restricted=new Set(["rgb(46, 125, 91)","rgb(63, 171, 124)","rgb(179, 70, 47)","rgb(217, 129, 110)"]);
          const colourViolations=[...document.querySelectorAll("main *,footer *")].filter(element=>{
            if(element.closest(".status-pass,.status-fail,.status-review,[data-result],[data-status],[data-unknown]"))return false;
            const s=getComputedStyle(element);
            return [s.color,s.backgroundColor,s.borderColor].some(value=>restricted.has(value));
          }).length;
          return {font:getComputedStyle(document.body).fontFamily,bodyWeight:style?.fontWeight,
            lineHeight:style?parseFloat(style.lineHeight)/parseFloat(style.fontSize):0,
            mono:num?getComputedStyle(num).fontFamily:"",colourViolations,
            marks:[...document.querySelectorAll('img[src*="/brand/"]')].map(node=>node.getAttribute("src"))};
        });
      }
      await page.close();
    }
    let assetsMatch=false;
    if(visual?.marks.length&&manifest.response.status===200){
      const data=JSON.parse(manifest.text);
      const assets=[...visual.marks,"/icons/favicon.ico",...(data.icons??[]).map(icon=>icon.src)];
      assetsMatch=true;
      for(const asset of new Set(assets)){
        if(!/^\/(?:brand|icons)\/[^/]+$/.test(asset)){assetsMatch=false;break;}
        const response=await fetch(new URL(asset,options.base));
        const expected=await readFile(path.join("public",asset));
        if(!response.ok||!Buffer.from(await response.arrayBuffer()).equals(expected)){assetsMatch=false;break;}
      }
    }
    record("6",healthy&&assetsMatch,healthy?"Served branding, favicon and manifest icon bytes match existing local branding outputs.":blocked);
    record("6a",healthy&&visual&&/IBM.*Plex.*Sans/i.test(visual.font)&&Number(visual.bodyWeight)<=400&&Math.abs(visual.lineHeight-1.9)<0.25,healthy?`Computed body font/weight/line-height inspected; numerical styling also covered by fixture checks.`:blocked);
    record("6b",healthy&&visual?.colourViolations===0,healthy?`Restricted-colour violations outside Shariah status: ${visual?.colourViolations}.`:blocked);
    const text=rendered.join("\n");
    const register=/\b(recommendation|advice|should buy|target price|guaranteed)\b/i;
    record("6c",healthy&&!register.test(text),healthy?"Rendered copy checked; exact bilingual register and governed exceptions also covered by unit tests.":blocked);
    const chunks=[];
    for(const src of scripts){
      const response=await fetch(new URL(src,options.base),{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error("Client asset unavailable");
      chunks.push(await response.text());
    }
    record("7",!/\bThiqah\b|Shariah-Aware Stock Research|Edit with Base44|base44\.app/i.test([...rendered,...chunks].join("\n")),"Searched rendered pages and served client chunks for old branding.");
    record("9",chunks.length>0&&chunks.every(chunk=>detectSensitive(chunk).length===0),`Scanned ${chunks.length} served client chunks using the existing secret-pattern scanner; no secret values recorded.`);
    record("12",healthy&&consoleErrors.length===0,`${blocked} Console/uncaught error count: ${consoleErrors.length}.`);
  } finally {await browser.close();}
  record("10",false,"Not live-verified: actual stored-run replay requires an authenticated admin/editor session. No rerun or database write was performed; offline deterministic engine tests are reported separately.");
  record("11",false,"Not live-verified: no invalid narrative was injected and no authenticated guardrail probe was available. Do not treat offline checks as proof of a live structured-only fallback.");
  const rows=CHECKS.map(([id])=>results.get(id)??{id,check:CHECKS.find(row=>row[0]===id)[1],status:"FAIL",detail:"Check did not finish."});
  const report={base:options.base,stock:options.stock,indexing:"public-unindexed",checkedAt:new Date().toISOString(),rows};
  await mkdir(path.dirname(options.output),{recursive:true});
  await writeFile(options.output,JSON.stringify(report,null,2)+"\n");
  for(const row of rows)console.log(`${row.status} ${row.id}: ${row.check} — ${row.detail}`);
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const report=await runLiveCheck(parseLiveArguments(process.argv.slice(2)));
    if(report.rows.some(row=>row.status==="FAIL"))process.exitCode=1;
  }catch{console.error("Live check failed before completion; check server/browser availability and arguments.");process.exitCode=1;}
}
