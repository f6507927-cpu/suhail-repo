import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdir,readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
async function main() {
const out="generated-artifacts/ui-nine-browser";
await mkdir(out,{recursive:true});
await build({entryPoints:["tests/ui-nine-browser/app.tsx"],outdir:out,bundle:true,format:"iife",platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"test"'},alias:{
  "@":path.resolve("src"),
  "next/navigation":path.resolve("tests/browser-fixture/router.ts"),
  "@/i18n/navigation":path.resolve("tests/browser-fixture/navigation.tsx"),
  "@/lib/auth/browser":path.resolve("tests/browser-fixture/auth.ts"),
  "next/image":path.resolve("tests/ui-nine-browser/image.tsx"),
  "@/app/[locale]/(private)/admin/(protected)/financial-actions":path.resolve("tests/browser-fixture/financial-actions.ts"),
  "@/app/[locale]/(private)/admin/(protected)/screening-actions":path.resolve("tests/browser-fixture/screening-actions.ts"),
}});
const globalCss=await postcss([tailwindcss()]).process(await readFile("src/app/globals.css","utf8"),{from:"src/app/globals.css"});
const css=`${globalCss.css}\n${await readFile(`${out}/app.css`,"utf8")}`;
createServer(async(req,res)=>{
  const url=new URL(req.url??"/","http://127.0.0.1:3309");
  if(url.pathname==="/app.js"){res.setHeader("Content-Type","application/javascript");res.end(await readFile(`${out}/app.js`));return;}
  if(url.pathname==="/app.css"){res.setHeader("Content-Type","text/css");res.end(css);return;}
  if(url.pathname.startsWith("/fonts/")||url.pathname.startsWith("/brand/")){
    const publicRoot=path.resolve("public"),file=path.resolve(publicRoot,`.${url.pathname}`);
    if(!file.startsWith(`${publicRoot}/`)){res.writeHead(404).end();return;}
    try {res.setHeader("Content-Type",file.endsWith(".woff2")?"font/woff2":"image/svg+xml");res.end(await readFile(file));}
    catch {res.writeHead(404).end();} return;
  }
  res.setHeader("Content-Type","text/html");res.end('<!doctype html><html lang="ar" dir="rtl" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Local admin fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
}).listen(3309,"0.0.0.0",()=>console.log("UI-9 isolated mock fixtures ready on 3309"));
}
void main();
