import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { execFileSync } from "node:child_process";
import { httpActionChecks } from "../tests/performance/http-actions";

async function main() {
const http = process.argv.includes("--http-actions");
const httpRender = process.argv.includes("--http-render");
const baseline = process.argv.includes("--baseline");
const output = resolve(`generated-artifacts/performance-${http ? "http-actions" : httpRender ? `http-render-${baseline ? "before" : "after"}` : "fixture"}`);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [http ? "tests/performance/action-entry.ts" : httpRender ? "tests/performance/render-entry.tsx" : "tests/performance/run.tsx"],
  outfile: `${output}/run.cjs`, bundle: true, platform: "node", format: "cjs",
  external: ["react", "react/*", "next/*", "drizzle-orm", "drizzle-orm/*", "@supabase/ssr", "@supabase/supabase-js"],
  jsx: "automatic",
  // Next initializes this global before loading its RSC renderer. Without it,
  // the standalone edge renderer cannot preserve request context across await.
  banner: { js: 'globalThis.AsyncLocalStorage = require("node:async_hooks").AsyncLocalStorage;' },
  alias: {
    "@": resolve("src"),
    "next/headers": resolve("tests/performance/headers.ts"),
    "next/navigation": resolve("tests/performance/navigation.ts"),
    "next-intl/server": resolve("tests/performance/components.tsx"),
    "next-intl/middleware": resolve("node_modules/next-intl/dist/esm/production/middleware.js"),
    "@/components/accounts": resolve("tests/performance/components.tsx"),
    "@/components/accounts/private-page-metadata": resolve("src/components/accounts/private-page-metadata.ts"),
    "@/components/methodology/AdminMethodologies": resolve("tests/performance/components.tsx"),
  },
  plugins: [{
    name: "isolated-provider-and-database",
    setup(builder) {
      builder.onResolve({ filter: /^@supabase\/ssr$/ }, ({ importer }) => {
        if (importer.endsWith("/src/lib/auth/server.ts"))
          return { path: resolve("tests/performance/sdk.ts") };
      });
      if (process.argv.includes("--baseline")) {
        const reference = process.argv.find(arg => arg.startsWith("--baseline-ref="))?.slice("--baseline-ref=".length) ?? "HEAD";
        builder.onLoad({ filter: /\/src\/(?:lib\/auth\/guards|lib\/methodology\/admin-data)\.ts$/ }, ({ path }) => ({
          contents: execFileSync("git", ["show", `${reference}:${path.slice(process.cwd().length + 1)}`], { encoding: "utf8" }),
          loader: "ts",
          resolveDir: resolve(path, ".."),
        }));
      }
      builder.onResolve({ filter: /^server-only$/ }, () => ({
        path: "server-only", namespace: "empty",
      }));
      builder.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "" }));
      builder.onResolve({ filter: /(?:\/|\.\.\/)db\/app$/ }, () => ({
        path: resolve("tests/performance/database.ts"),
      }));
      builder.onResolve({ filter: /methodology-actions$/ }, () => ({
        path: resolve("tests/performance/components.tsx"),
      }));
      builder.onResolve({ filter: /^next\/cache$/ }, () => ({
        path: resolve("tests/performance/bulk-jobs.ts"),
      }));
      builder.onResolve({ filter: /(?:jobs\/(?:ingest-sec|screen-universe)|screening\/(?:service|verify)|lib\/financial\/persistence)$/ }, () => ({
        path: resolve("tests/performance/bulk-jobs.ts"),
      }));
    },
  }],
});
if (http || httpRender) {
  await httpActionChecks(output, httpRender ? "render" : "actions", baseline);
  return;
}
const child = spawnSync(process.execPath, ["--conditions=react-server", `${output}/run.cjs`, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { PATH: process.env.PATH, NODE_ENV: "production", SITE_MODE: "live",
    NEXT_PUBLIC_SUPABASE_URL: "https://auth.fixture.test",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon" },
  timeout: 60_000,
});
process.exitCode = child.status ?? 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
