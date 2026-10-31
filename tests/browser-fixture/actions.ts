import type { ActionResult } from "../../src/components/accounts/types";

// Test-process state only. No database, provider or runtime server actions.
export const accountFixture = {
  calls: [] as { action: string; args: unknown[] }[],
  fail: false,
  throwFailure: false,
  hold: false,
  release: null as (() => void) | null,
  unmount: null as (() => void) | null,
  async action(action: string, ...args: unknown[]): Promise<ActionResult> {
    this.calls.push({ action, args });
    if (this.hold) {
      await new Promise<void>((resolve) => { this.release = resolve; });
      this.release = null;
    }
    if (this.throwFailure) throw new Error("fixture_failure");
    return this.fail ? { ok: false, error: "fixture_failure" } : { ok: true };
  },
};

declare global {
  interface Window {
    accountFixture: typeof accountFixture;
  }
}
