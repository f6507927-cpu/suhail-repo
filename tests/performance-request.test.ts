import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("real RSC requests deduplicate guards and action execution preserves independent checks", async () => {
  const { stdout } = await promisify(execFile)("pnpm", [
    "exec", "tsx", "scripts/performance-fixture.ts", "--test",
  ], { timeout: 60_000, maxBuffer: 128 * 1024 });
  expect(stdout).toContain('"regressionAssertions":"passed"');
  expect(stdout).toContain('"authCalls":4');
}, 75_000);
