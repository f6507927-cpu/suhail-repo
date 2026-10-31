import { runUniverseAction } from "../../src/app/[locale]/(private)/admin/(protected)/screening-actions";
import { requests, scenario } from "./state";
import { installTransport } from "./transport";

// Entry point bundled only into the generated, credential-free Next test app.
export async function execute(kind: "ingest" | "screen" | "cancel") {
  const s = scenario({ cancelLock: kind === "cancel" });
  installTransport();
  const result = await requests.run(s, () => runUniverseAction(kind === "cancel" ? "screen" : kind));
  return { kind, result, authCalls: s.calls.length, roleLookups: s.lookups,
    transactionLocks: s.locks, transactionalRoleRechecks: s.rechecks,
    commits: s.commits, rollbacks: s.rollbacks, sessionReads: s.sessionReads };
}
