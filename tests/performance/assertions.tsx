import assert from "node:assert/strict";
import { createElement } from "react";
// @ts-expect-error Next's private renderer has no public declarations.
import { renderToReadableStream } from "next/dist/compiled/react-server-dom-webpack/server.edge";
import { actionAsyncStorage } from "next/dist/server/app-render/action-async-storage.external";
import { verifiedIdentity, requireUser, requireRole, requirePageRole, requireConsentUser, requireMfaBootstrap } from "../../src/lib/auth/guards";
import { readMethodologies } from "../../src/lib/methodology/admin-data";
import { runUniverseAction } from "../../src/app/[locale]/(private)/admin/(protected)/screening-actions";
import { requests, scenario, token, type State } from "./state";

async function rendering(s: State, work: () => Promise<void>) {
  return requests.run(s, async () => {
    const errors: unknown[] = [];
    async function Component() { await work(); return createElement("p", null, "checked"); }
    await new Response(renderToReadableStream(createElement(Component), {}, {
      onError: (error: unknown) => { errors.push(error); },
    })).text();
    if (errors.length) throw errors[0];
  });
}
async function denial(s: State, code: string) {
  await rendering(s, async () => {
    await assert.rejects(requireRole(["admin", "editor"]), { code });
    await assert.rejects(readMethodologies(), { code });
  });
  assert.equal(s.queries.length, 0, "Denied guards must start no methodology reads");
  assert.equal(s.calls.length, s.missingToken ? 0 : 1);
}
export async function assertions() {
  const a = scenario();
  await rendering(a, async () => {
    const identity = await verifiedIdentity();
    assert.equal(await verifiedIdentity(), identity);
    assert.equal(await requireUser({}), await requireUser({ consent: true }));
    assert.equal(await requireRole(["editor", "admin"]), await requireRole(["admin", "editor", "admin"]));
    assert.equal((await requireRole(["admin"])).identity.id, a.id);
    await assert.rejects(requireRole(["editor"]), { code: "role_required" });
    assert.equal(a.calls.length, 1);
    assert.deepEqual(a.verifiedTokens, [token()], "Exact cookie access token must be verified");
    assert.equal((await readMethodologies()).sources.length, 0);
  });
  assert.equal(a.lookups, 1);
  assert.equal(a.sessionReads, 1);
  assert.equal(a.maxActive, 5);
  const b = scenario({ id: "00000000-0000-4000-8000-000000000002", role: "editor" });
  await rendering(b, async () => {
    assert.equal((await requireRole()).identity.id, b.id);
    await assert.rejects(requireRole(["admin"]), { code: "role_required" });
  });
  assert.equal(b.calls.length, 1, "A separate request must verify identity anew");
  assert.equal(b.sessionReads, 1);
  // Run requests concurrently as well, proving values/errors do not cross users.
  await Promise.all([
    rendering(scenario(), async () => { await requireRole(["admin"]); }),
    denial(scenario({ role: "user" }), "role_required"),
  ]);
  await denial(scenario({ aal: "aal1" }), "mfa_verify_required");
  await denial(scenario({ aal: "aal1", factors: [] }), "mfa_enroll_required");
  await denial(scenario({ aal: "aal1", factors: [], cookieFactors: a.factors }), "mfa_enroll_required");
  await denial(scenario({ factors: [] }), "mfa_enroll_required");
  await denial(scenario({ factors: [], cookieFactors: a.factors }), "mfa_enroll_required");
  await denial(scenario({ factors: a.factors!.map(f => ({ ...f, status: "unverified" })) }), "mfa_enroll_required");
  for (const aal of ["aal1", "aal2"]) {
    await denial(scenario({ aal, factors: a.factors!.map(f => ({ ...f, factor_type: "phone" })) }), "mfa_enroll_required");
  }
  for (const aal of [undefined, null, "aal3", 2, {}, ""]) {
    await denial(scenario({ aal }), "sign_in_required");
  }
  await denial(scenario({ token: "not.a.jwt" }), "sign_in_required");
  await denial(scenario({ token: "missing-segments" }), "sign_in_required");
  await denial(scenario({ rejectProvider: true }), "sign_in_required");
  await denial(scenario({ missingToken: true }), "sign_in_required");
  const stale = scenario({ consent: false });
  await rendering(stale, async () => {
    const error = await requireUser({ consent: true }).catch(e => e);
    assert.equal(error.code, "consent_required");
    assert.equal(await requireUser({ consent: true }).catch(e => e), error);
    assert.equal((await requireUser({ consent: false })).user.id, stale.id);
    assert.equal((await requireConsentUser("en", "/en/account")).identity.id, stale.id);
    await assert.rejects(requirePageRole("en", "/en/admin/methodologies"), /REDIRECT:\/en\/auth\/consent\?next=%2Fadmin%2Fmethodologies/);
  });
  const enrollment = scenario({ aal: "aal1", factors: [] });
  await rendering(enrollment, async () => {
    assert.equal((await requireMfaBootstrap()).identity.id, enrollment.id);
    await assert.rejects(requirePageRole("en", "/en/admin"), /REDIRECT:\/en\/admin\/mfa\/enroll\?next=%2Fadmin%2Fmethodologies/);
  });
  await rendering(scenario({ aal: "aal1" }), async () => {
    await assert.rejects(requirePageRole("ar", "/admin"), /REDIRECT:\/admin\/mfa\/verify\?next=%2Fadmin%2Fmethodologies/);
  });
  await rendering(scenario({ role: "user" }), async () => {
    await assert.rejects(requireMfaBootstrap(), { code: "role_required" });
    await assert.rejects(requirePageRole("en", "/en/admin"), /FORBIDDEN:403/);
  });
  const actions = [];
  for (const kind of ["ingest", "screen"] as const) {
    const s = scenario();
    // Execute the real exported bulk Server Action in Next's action context,
    // OUTSIDE any React render. Job callbacks/DB are bounded fixture boundaries.
    await requests.run(s, () => actionAsyncStorage.run({ isAction: true }, async () => {
      assert.equal((await runUniverseAction(kind)).ok, true);
    }));
    assert.equal(s.calls.length, 4);
    assert.equal(s.lookups, 4);
    assert.equal(s.locks, 3);
    assert.equal(s.rechecks, 3);
    assert.equal(s.commits, 3);
    actions.push({ kind, authCalls: s.calls.length, roleLookups: s.lookups,
      transactionLocks: s.locks, transactionalRoleRechecks: s.rechecks });
  }
  const cancelled = scenario({ cancelLock: true });
  await requests.run(cancelled, () => actionAsyncStorage.run({ isAction: true }, async () => {
    assert.deepEqual(await runUniverseAction("screen"), {
      ok: false, error: "Screening operation failed. Check the inputs and methodology, then try again.",
    });
  }));
  assert.equal(cancelled.rollbacks, 1);
  assert.equal(cancelled.commits, 0);
  assert.equal(cancelled.rechecks, 0);
  console.log(JSON.stringify({ regressionAssertions: "passed", actionExecution: actions,
    actionLimitation: "Real action function and Next action context; fixture job callbacks, no HTTP action-dispatch or live SEC calls" }));
}
