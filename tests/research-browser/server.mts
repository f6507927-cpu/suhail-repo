import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { fixtureInput, fixturePackets, FIXTURE_CLOCK } from "../fixtures/research/packets";
import { handwrittenModel } from "../fixtures/research/outputs";
import { assembleDraft } from "../../src/ai/research/draft";
import { buildResearchPacket } from "../../src/ai/research/packet";
import { compareResearchPackets } from "../../src/ai/research/changes";
import type { PublicStockResearch } from "../../src/stock/research-public-types";
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
const changedRows = fixtureInput();
changedRows.periods[0].facts[0].value = changedRows.periods[0].facts[0].value! + 100;
changedRows.prices[0].close += 10;
const freshPacket = buildResearchPacket(changedRows, FIXTURE_CLOCK);
const revisedModel = handwrittenModel(freshPacket);
revisedModel.summary = { en: "A recent filing changed the available evidence.", ar: "غيّر التقرير الجديد البيانات المتاحة." };
const fixture = JSON.stringify({ packet, draft: assembleDraft(handwrittenModel(packet), packet),
  refreshed: assembleDraft(revisedModel, freshPacket), changes: compareResearchPackets(packet, freshPacket) }).replaceAll("<", "\\u003c");
const publicFixture: PublicStockResearch = {
  plain_summary: [
    { en: "New filing evidence is reflected in the figures.", ar: "يعكس الملخص البيانات الواردة في التقرير الجديد." },
    { en: "The record cites the latest stored financial period.", ar: "تشير البيانات إلى آخر فترة مالية مسجلة." },
    { en: "The record includes \u20662\u2069 results.", ar: "يتضمن السجل \u20662\u2069 من النتائج." },
  ],
  analyst_view: { thesis: [{ en: "Synthetic private-to-public thesis", ar: "رأي المحلل في المثال التجريبي" }],
    evidence: [], risks: [], valuation: { en: "Synthetic valuation", ar: "تقييم تجريبي" } },
  methodologies: [{ slug: "fixture", label: "Synthetic methodology", status: "passes_selected_methodology" }],
  citations: [{ source_id: "fixture-source", label: "Synthetic evidence record" }],
  name_ar: "محلل تجريبي", name_en: "Synthetic analyst", title_ar: null, title_en: null, credentials: "CFA",
  headshot_object_key: null, bio_ar: null, bio_en: null, approval_at: "2026-11-21", data_as_of: "2026-11-20",
  update_codes: ["new_filing"], updated_at: "2026-11-22", outdated_codes: ["aged"], outdated_at: "2026-11-23",
};
createServer(async (req, res) => {
  if (req.url === "/health") { res.end("fixture ready"); return; }
  if (req.url === "/client.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(`${out}/client.js`)); return; }
  if (req.url?.startsWith("/api/stock-research/")) {
    res.setHeader("Cache-Control", "no-store");
    const mode = req.url.split("/").at(-1);
    if (mode !== "eligible" && mode !== "hidden") { res.statusCode = 404; res.end(); return; }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...publicFixture, analyst_view: mode === "hidden" ? null : publicFixture.analyst_view }));
    return;
  }
  if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css"); res.end(css.css + "\n" + await readFile(`${out}/client.css`, "utf8")); return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"><title>Synthetic P2 research fixture</title></head><body><main id="app"></main><output hidden id="recording"></output><script type="application/json" id="fixture">' + fixture + '</script><script type="module" src="/client.js"></script></body></html>');
}).listen(3500, "0.0.0.0", () => console.log("Synthetic research UI ready on 3500"));
