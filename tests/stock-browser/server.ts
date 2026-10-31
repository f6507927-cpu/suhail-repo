import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import type { renderStock as RenderStock } from "./render";

// Separate test-only server. Supabase is forbidden here; use disposable loopback.
if (process.env.NODE_ENV !== "test") throw new Error("Stock browser harness is test-only");
const out = resolve("generated-artifacts/stock-fixtures");
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["tests/stock-browser/render.tsx"], outfile: `${out}/render.mjs`,
  bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
  alias: { "@": resolve("src"), "@/i18n/navigation": resolve("tests/browser-fixture/navigation.tsx"), "server-only": resolve("tests/stock-browser/empty.ts"), "next/image": resolve("tests/browser-fixture/image.tsx") },
});
const globals = await postcss([tailwindcss()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve("src/app/globals.css") });
const { renderStock } = await import(pathToFileURL(`${out}/render.mjs`).href) as { renderStock: typeof RenderStock };
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function imageUrls(images: unknown): string[] {
  return (Array.isArray(images) ? images : [images]).map(image => {
    const value = image && typeof image === "object" && "url" in image ? image.url : image;
    if (typeof value !== "string" && !(value instanceof URL)) throw new Error("Missing social image URL");
    return String(value);
  });
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3400");
  if (url.pathname === "/health") { response.end("ready"); return; }
  if (url.pathname === "/favicon.ico") { response.statusCode = 204; response.end(); return; }
  if (url.pathname === "/icons/icon-512.png") {
    response.setHeader("Content-Type", "image/png"); response.end(await readFile("public/icons/icon-512.png")); return;
  }
  if (url.pathname === "/style.css") { response.setHeader("Content-Type", "text/css"); response.end(`${globals.css}\n${await readFile(`${out}/render.css`, "utf8")}`); return; }
  if (url.pathname.startsWith("/brand/")) {
    if (!/^\/brand\/[a-z-]+\.svg$/.test(url.pathname)) { response.statusCode = 404; response.end(); return; }
    response.setHeader("Content-Type", "image/svg+xml"); response.end(await readFile(`public${url.pathname}`)); return;
  }
  const match = /^\/(en\/)?stock\/([a-z0-9-]+)$/.exec(url.pathname);
  if (!match) { response.statusCode = 404; response.end(); return; }
  const locale = match[1] ? "en" : "ar";
  try {
    const page = await renderStock(match[2], locale, url.searchParams.get("variant"));
    if (!page) { response.statusCode = 404; response.end("Not found"); return; }
    const meta = page.metadata;
    const title = typeof meta.title === "object" && meta.title && "absolute" in meta.title ? meta.title.absolute : "";
    const description = meta.description ?? "";
    const socialImages = [
      ...imageUrls(meta.openGraph?.images).map(image => `<meta property="og:image" content="${escape(image)}">`),
      ...imageUrls(meta.twitter?.images).map(image => `<meta name="twitter:image" content="${escape(image)}">`),
    ].join("");
    const twitterCard = meta.twitter && "card" in meta.twitter ? meta.twitter.card : "";
    const html = `<!doctype html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}" class="${url.searchParams.get("theme") === "light" ? "" : "dark"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title ?? "")}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(String(meta.openGraph?.title ?? ""))}"><meta property="og:description" content="${escape(meta.openGraph?.description ?? "")}">${socialImages}<meta name="twitter:card" content="${escape(twitterCard ?? "")}"><link rel="canonical" href="${escape(String(meta.alternates?.canonical))}"><link rel="stylesheet" href="/style.css"></head><body>${page.html}</body></html>`;
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html);
  } catch {
    response.statusCode = 500; response.end("Read unavailable"); // Errors are not cached.
  }
});
server.listen(3400, "127.0.0.1", () => console.log("Local stock SSR browser harness ready"));
