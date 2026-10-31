import { build } from "esbuild";

await build({
  entryPoints: { "ingest-sec": "src/jobs/run-ingest-sec.ts", "ingest-all": "src/jobs/run-ingest-all.ts",
    "screen-universe": "src/jobs/run-screen-universe.ts" },
  outdir: "dist/jobs", bundle: true, platform: "node", format: "esm",
  packages: "external",
  plugins: [{
    // This marker is for Next's client/server boundary, not a job runtime module.
    name: "trusted-node-server-marker",
    setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "marker", namespace: "server-marker" }));
      builder.onLoad({ filter: /.*/, namespace: "server-marker" }, () => ({ contents: "export {};" }));
    },
  }],
});
