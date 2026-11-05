import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import type { renderFixture as RenderFixture } from "./render";

if (process.env.NODE_ENV !== "test") throw new Error("UI-1 fixture server is test-only");
async function main() {
const out = resolve("generated-artifacts/ui-one");
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["tests/ui-one-browser/render.tsx"], outfile: `${out}/render.mjs`,
  bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
  alias: { "@": resolve("src"), "@/i18n/navigation": resolve("tests/ui-one-browser/navigation.tsx"),
    "server-only": resolve("tests/stock-browser/empty.ts"), "next/image": resolve("tests/browser-fixture/image.tsx") },
});
const global = await postcss([tailwindcss()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve("src/app/globals.css") });
const { renderFixture } = await import(pathToFileURL(`${out}/render.mjs`).href) as { renderFixture: typeof RenderFixture };
createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1:3400");
  if (url.pathname === "/health") { response.end("ready"); return; }
  if (url.pathname === "/style.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(global.css + await readFile(`${out}/render.css`, "utf8")); return;
  }
  const locale = url.pathname.startsWith("/en") ? "en" : "ar";
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(`<!doctype html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>${renderFixture(url.pathname, locale, url.searchParams.get("status"))}</body></html>`);
}).listen(3400, "0.0.0.0", () => console.log("UI-1 fixture server ready"));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
