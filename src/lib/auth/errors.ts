import { runtimeLog } from "../../security/logger";
export class AuthError extends Error {
  constructor(public status: 401 | 403 | 409 | 400 | 502 | 503, public code: string) { super(code); }
}
export type ActionResult = {ok: true} | {ok: false; error: string; status: number};
export function isLockTimeout(error: unknown): boolean {
  const failure = error as { code?: string; cause?: { code?: string } } | null;
  return failure?.code === "55P03" || failure?.cause?.code === "55P03";
}
export function actionError(error: unknown): ActionResult {
  if (error instanceof AuthError) return {ok: false, error: error.code, status: error.status};
  if (isLockTimeout(error)) return {
    ok: false, error: "The request failed. Reload the record and try again.", status: 503,
  };
  // Never expose provider/DB diagnostics to users.
  runtimeLog("action_failed", {status: 500});
  return {ok: false, error: "operation_failed", status: 500};
}
