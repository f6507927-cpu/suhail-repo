import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

// Test-only, DB-free fixture for the D-174 section. Never part of the real app.
async function main() {
  const out = path.resolve("generated-artifacts/other-methodologies-fixture");
  await mkdir(out, { recursive: true });
  const empty = path.join(out, "empty.js");
  await writeFile(empty, "export {};\n");
  const css = await postcss([tailwindcss()]).process(await readFile("src/app/globals.css", "utf8"), { from: path.resolve("src/app/globals.css") });
  await build({
    entryPoints: ["tests/other-methodologies-browser/fixture-app.tsx"], outdir: out, bundle: true, platform: "browser", format: "iife",
    loader: { ".module.css": "local-css" }, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    // Test bundle only: server helpers read optional env flags; none are set here.
    banner: { js: "var process = { env: { NODE_ENV: \"production\" } };" },
    alias: { "@": path.resolve("src"), "@/i18n/navigation": path.resolve("tests/browser-fixture/navigation.tsx"),
      "next/navigation": path.resolve("tests/browser-fixture/router.ts"), "server-only": empty },
  });
  createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1:3310");
    if (url.pathname === "/app.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css.css + await readFile(path.join(out, "fixture-app.css"), "utf8").catch(() => ""));
      return;
    }
    if (url.pathname === "/app.js") { res.setHeader("Content-Type", "application/javascript"); res.end(await readFile(path.join(out, "fixture-app.js"))); return; }
    const locale = url.pathname.startsWith("/en") ? "en" : "ar";
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Suhail section fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`);
  }).listen(3310, "127.0.0.1");
}
void main();
