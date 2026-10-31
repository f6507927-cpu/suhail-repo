import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("uses supported Autoscale command keys with no data-changing build/start hooks", () => {
  const dot = readFileSync(".replit", "utf8");
  const deployment = dot.split("[deployment]")[1].split(/\n\[/)[0];
  expect(deployment).toContain('deploymentTarget = "cloudrun"');
  expect(deployment).toContain('build = ["sh", "-c", "pnpm install --frozen-lockfile && pnpm build"]');
  expect(deployment).toContain('run = ["pnpm", "start"]');
  expect(deployment).not.toMatch(/migrate|seed|import|healthCheck|minInstances|maxInstances/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.scripts.start).toBe("next start -H 0.0.0.0 -p ${PORT:-3000}");
  expect(pkg.scripts.build).toBe("next build");
  expect(pkg.scripts.smoke).toBe("node scripts/smoke.mjs");
});
it("the dormant authorized-only timeout probe requires Session 5432 without changing timeout policy", () => {
  const source = readFileSync("scripts/db/runtime-timeout-probe.ts", "utf8");
  expect(source).toContain("options.port[0] !== 5432");
  expect(source).toContain("sessionPort: 5432");
  expect(source).not.toMatch(/transactionPort|6543/);
  const options = readFileSync("src/db/runtime-client.ts", "utf8");
  expect(options).not.toMatch(/statement_timeout|lock_timeout|transaction_timeout/);
});
