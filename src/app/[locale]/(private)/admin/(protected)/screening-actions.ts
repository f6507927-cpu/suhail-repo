"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { withAdminAction } from "@/lib/auth/actions";
import { actionError, isLockTimeout } from "@/lib/auth/errors";
import { FinancialError } from "@/lib/financial/persistence";
import { screenSecurity } from "@/screening/service";
import { verifyRun } from "@/screening/verify";
import { screenUniverse } from "@/jobs/screen-universe";
import { ingestUniverse } from "@/jobs/ingest-sec";
import type { Mutation } from "@/ingest/sec/ingest";
import type { ScreenActionResult, VerifyActionResult, BulkActionResult } from "@/screening/contracts";
import { revalidatePublic } from "@/security/revalidate-public";
import { runtimeLog } from "@/security/logger";

function failure(error: unknown): { ok: false; error: string } {
  runtimeLog("runtime_failed");
  if (error instanceof FinancialError) return { ok: false, error: error.message };
  if (isLockTimeout(error) || error instanceof Error && error.name === "AuthError") {
    const auth = actionError(error);
    if (!auth.ok) return auth;
  }
  return { ok: false, error: "Screening operation failed. Check the inputs and methodology, then try again." };
}
function refresh() {
  for (const prefix of ["", "/en"]) {
    revalidatePath(`${prefix}/admin/securities`);
    revalidatePath(`${prefix}/admin/ingestion`);
  }
}
export async function runScreenAction(input: { securityId: string; methodologyVersionId: string }): Promise<ScreenActionResult> {
  await requireRole(["admin"]);
  const mutate: Mutation = work => withAdminAction(["admin"], work);
  try {
    const result = await screenSecurity(input.securityId, input.methodologyVersionId,
      { asOf: new Date().toISOString().slice(0, 10), trigger: "manual" }, mutate);
    refresh();
    if (!result.unchanged) revalidatePublic("screening");
    return { ok: true, ...result };
  } catch (error) { return failure(error); }
}
export async function verifyScreenAction(runId: string): Promise<VerifyActionResult> {
  await requireRole(["admin", "editor"]);
  try { return { ok: true, verification: await verifyRun(runId) }; }
  catch (error) { return failure(error); }
}
export async function runUniverseAction(kind: "ingest" | "screen", id?: string): Promise<BulkActionResult> {
  await requireRole(["admin"]);
  const mutate: Mutation = work => withAdminAction(["admin"], work);
  try {
    if (kind !== "ingest" && kind !== "screen") return { ok: false, error: "Unknown universe operation" };
    const result = kind === "ingest" ? await ingestUniverse(id, mutate) : await screenUniverse(id, mutate);
    refresh();
    if (result.summary.inserted > 0) revalidatePublic(kind === "screen" ? "screening" : "financial");
    return { ok: true, ...result };
  } catch (error) { refresh(); return failure(error); }
}
