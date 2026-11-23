import { execFileSync } from "node:child_process";

/** Undo the existing synthetic eligibility override; never a hosted target. */
export default function teardown() {
  // Use the same tsx module boundary as setup, not Playwright's ESM/CJS loader.
  execFileSync("pnpm", ["exec", "tsx", "tests/other-methodologies-browser/cleanup.ts"], {
    env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit",
  });
}
