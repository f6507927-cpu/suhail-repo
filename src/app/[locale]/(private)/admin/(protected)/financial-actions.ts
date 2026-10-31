"use server";
import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { withAdminAction } from "@/lib/auth/actions";
import { actionError, isLockTimeout } from "@/lib/auth/errors";
import { addSecurity, idSchema, mutateFinancial } from "@/lib/financial/service";
import { FinancialError } from "@/lib/financial/persistence";
import { lookupSecurity, ingestSecurity, safeIngestError, type Mutation } from "@/ingest/sec/ingest";
import { runIngestBatch } from "@/jobs/ingest-sec";
import type { FinancialCommand, FinancialResult } from "@/lib/financial/contracts";
import { revalidatePublic } from "@/security/revalidate-public";

export async function financialAction(command: FinancialCommand): Promise<FinancialResult> {
  await requireRole(["admin"]);
  const mutate: Mutation = work => withAdminAction(["admin"], work);
  try {
    let id: string | undefined;
    if (command.operation === "lookup" || command.operation === "add") {
      const { ticker } = z.object({ ticker: z.string().min(1).max(20) }).parse(command.data);
      const lookup = await lookupSecurity(ticker);
      if (command.operation === "lookup") return { ok: true, lookup };
      id = await mutate((tx, actor) => addSecurity(tx, actor, lookup));
      // A failed initial import leaves the committed listing visible and retryable.
      await ingestSecurity(id, mutate);
    } else if (command.operation === "ingest") {
      id = idSchema.parse(command.securityId);
      await ingestSecurity(id, mutate);
    } else if (command.operation === "runJob" || command.operation === "resumeJob") {
      id = await runIngestBatch(command.operation === "resumeJob" ? idSchema.parse(command.data?.id) : undefined, mutate);
    } else {
      id = await mutate((tx, actor) => mutateFinancial(tx, actor, command));
    }
    for (const prefix of ["", "/en"]) {
      revalidatePath(`${prefix}/admin/securities`); revalidatePath(`${prefix}/admin/ingestion`);
    }
    revalidatePublic("financial");
    return { ok: true, id };
  } catch (error) {
    // Refresh even on initial-ingest failure so its committed retryable listing is visible.
    for (const prefix of ["", "/en"]) revalidatePath(`${prefix}/admin/securities`);
    if (error instanceof FinancialError) return { ok: false, error: error.message };
    if (error instanceof ZodError) return { ok: false, error: error.issues.map(i => i.message).join("; ") };
    const auth = actionError(error);
    if (!auth.ok && (isLockTimeout(error) || error instanceof Error && error.name === "AuthError")) return auth;
    if (["ingest", "add", "runJob", "resumeJob"].includes(command.operation))
      return { ok: false, error: safeIngestError(error) };
    return { ok: false, error: "The financial operation failed. Check values and source references, reload the record and try again." };
  }
}
