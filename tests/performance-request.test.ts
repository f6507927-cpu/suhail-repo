import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { requests, scenario, token } from "./performance/state";

it("keeps the same fixture cookie token when the clock advances", () => {
  requests.run(scenario(), () => {
    const original = token();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2000);
    try {
      expect(token()).toBe(original);
    } finally {
      clock.mockRestore();
    }
  });
});

it("real RSC requests deduplicate guards and action execution preserves independent checks", async () => {
  const { stdout } = await promisify(execFile)("pnpm", [
    "exec", "tsx", "scripts/performance-fixture.ts", "--test",
  ], { timeout: 60_000, maxBuffer: 128 * 1024 });
  expect(stdout).toContain('"regressionAssertions":"passed"');
  expect(stdout).toContain('"authCalls":4');
}, 75_000);
