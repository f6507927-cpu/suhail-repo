import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Read-only candidate gate. Never change application/CLI settings to run it.
// The generated bundle uses the actual runtime factories, TLS and role checks,
// with only the proposed startup settings injected into runtimeOptions.
const output = resolve("generated-artifacts/runtime-timeout-check");
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["scripts/db/runtime-timeout-probe.ts"],
  outfile: `${output}/probe.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  plugins: [{
    name: "isolated-timeout-candidate",
    setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({
        path: "server-only",
        namespace: "empty-server-marker",
      }));
      builder.onLoad({ filter: /.*/, namespace: "empty-server-marker" }, () => ({
        contents: "",
      }));
      builder.onLoad({ filter: /\/src\/db\/runtime-client\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, "utf8");
        const marker = "export const runtimeOptions = {";
        if (!source.includes(marker)) throw new Error("Runtime options marker changed");
        return {
          contents: source.replace(marker, `${marker}
  connection: {
    statement_timeout: 10000,
    idle_in_transaction_session_timeout: 10000,
  },`),
          loader: "ts",
          resolveDir: resolve("src/db"),
        };
      });
    },
  }],
});
const result = spawnSync(process.execPath, [`${output}/probe.mjs`], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
  timeout: 45_000,
});
if (result.error) console.error("Runtime timeout gate did not finish; candidate not approved.");
process.exitCode = result.status ?? 1;
