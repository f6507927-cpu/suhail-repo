import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { fixturePackets } from "../fixtures/research/packets";
import { handwrittenModel } from "../fixtures/research/outputs";
import { assembleDraft } from "../../src/ai/research/draft";
if (process.env.NODE_ENV !== "test") throw new Error("Research UI harness is fixture-only");
const out = resolve("generated-artifacts/research-ui");
await mkdir(out, { recursive: true });
await build({ entryPoints: ["tests/research-browser/client.tsx"], outfile: `${out}/client.js`,
  bundle: true, platform: "browser", format: "esm", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  alias: { "@": resolve("src"), "@/i18n/navigation": resolve("tests/browser-fixture/navigation.tsx"),
    "next/navigation": resolve("tests/research-browser/navigation.ts") } });
const css = await postcss([tailwindcss()]).process(await readFile("src/app/globals.css", "utf8"),
  { from: resolve("src/app/globals.css") });
const packet = fixturePackets[0];
const fixture = JSON.stringify({ packet, draft: assembleDraft(handwrittenModel(packet), packet) }).replaceAll("<", "\\u003c");
createServer(async (req, res) => {
  if (req.url === "/health") { res.end("fixture ready"); return; }
  if (req.url === "/client.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(`${out}/client.js`)); return; }
  if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css.css + "\n" + await readFile(`${out}/client.css`, "utf8")); return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Synthetic P2 research fixture</title></head><body><main id="app"></main><output hidden id="recording"></output><script type="application/json" id="fixture">' + fixture + '</script><script type="module" src="/client.js"></script></body></html>');
}).listen(3500, "0.0.0.0", () => console.log("Synthetic research UI ready on 3500"));
