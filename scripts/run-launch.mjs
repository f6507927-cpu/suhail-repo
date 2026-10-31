import { build } from "esbuild";
import { spawn } from "node:child_process";

// In-memory bundle: no checkpoint or generated file, including during dry-run.
// The server-only marker is a Next boundary, not a standalone CLI dependency.
const result = await build({
  entryPoints: ["scripts/launch/setup.ts"], bundle: true, write: false,
  platform: "node", format: "esm", packages: "external",
  banner: { js: 'import { createRequire as launchRequire } from "node:module"; const require = launchRequire(process.cwd() + "/package.json");' },
  plugins: [{
    name: "trusted-workspace-server-marker",
    setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "marker", namespace: "server-marker" }));
      builder.onLoad({ filter: /.*/, namespace: "server-marker" }, () => ({ contents: "export {};" }));
    },
  }],
});
const child = spawn(process.execPath, ["--input-type=module", "-", ...process.argv.slice(2)], {
  stdio: ["pipe", "inherit", "inherit"],
});
child.stdin.end(result.outputFiles[0].text);
child.on("exit", code => { process.exitCode = code ?? 1; });
