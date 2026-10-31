import type { BulkActionResult, ScreenActionResult, VerifyActionResult } from "../../src/screening/contracts";

type FixtureCall = { action: string; args: unknown[] };
const storedCalls = (): FixtureCall[] => {
  try { return JSON.parse(window.sessionStorage.getItem("screening-fixture-calls") ?? "[]") as FixtureCall[]; }
  catch { return []; }
};
export const screeningFixture = {
  calls: storedCalls(),
  reset() { this.calls.length = 0; window.sessionStorage.removeItem("screening-fixture-calls"); },
};
function record(action: string, args: unknown[]) {
  screeningFixture.calls.push({ action, args });
  window.sessionStorage.setItem("screening-fixture-calls", JSON.stringify(screeningFixture.calls));
}

export async function runScreenAction(input: { securityId: string; methodologyVersionId: string }): Promise<ScreenActionResult> {
  record("runScreenAction", [structuredClone(input)]);
  return { ok: true, unchanged: true, runId: "33333333-3333-4333-8333-333333333333" };
}
export async function verifyScreenAction(runId: string): Promise<VerifyActionResult> {
  record("verifyScreenAction", [runId]);
  const mode = new URLSearchParams(window.location.search).get("verify");
  const failed = mode === "fail" || mode === "unsupported-tampered";
  const unsupported = mode === "unsupported" || mode === "unsupported-tampered";
  return { ok: true, verification: {
    valid: !failed, hashMatches: !failed, replayMatches: unsupported ? null : !failed,
    replaySupported: !unsupported, engineVersion: unsupported ? "engine-0.9.0" : "engine-1.0.1",
    storedHash: "abcdef0123456789abcdef0123456789",
    computedHash: failed ? "fedcba9876543210fedcba9876543210" : "abcdef0123456789abcdef0123456789",
    differences: failed ? [{ path: unsupported ? "$.immutable_hash" : "outputs.status", expected: "pass", actual: "fail" }] : [],
  } };
}
export async function runUniverseAction(kind: "ingest" | "screen", id?: string): Promise<BulkActionResult> {
  record("runUniverseAction", [kind, id]);
  if (new URLSearchParams(window.location.search).get("bulk") === "cancel") {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { ok: false, error: "Screening operation failed. Check the inputs and methodology, then try again." };
  }
  if (new URLSearchParams(window.location.search).get("bulk") === "gate")
    return { ok: false, error: "No production methodology to screen with" };
  return { ok: true, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", summary: { processed: 8, failed: 1, unchanged: 2, inserted: 5, status: "completed" } };
}

declare global {
  interface Window { screeningFixture: typeof screeningFixture }
}
