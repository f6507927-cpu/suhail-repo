import "server-only";
import { runtimeLog, type OAuthFailureReason, type OAuthStartStage } from "../../security/logger";
import { AuthError } from "./errors";

/** Classify locally; never pass an exception, message, URL or request to the logger. */
export function logOAuthStartFailure(stage: OAuthStartStage, error: unknown, status: number) {
  if (status < 500) return;
  let reason: OAuthFailureReason = "unexpected";
  if (error instanceof AuthError) reason = "auth_rejected";
  else if (error instanceof Error) {
    if (error.message.startsWith("Authentication environment validation failed. Check these variable names: ")) reason = "auth_environment";
    else if (error.message === "invalid_oauth_destination") reason = "invalid_destination";
    else if ("code" in error && error.code === "ERR_INVALID_URL") reason = "invalid_url";
    else if (error.name === "TimeoutError" || error.name === "AbortError") reason = "timeout";
    else if (error instanceof TypeError && error.message === "fetch failed") reason = "fetch_failed";
  }
  // Inspect at most two causes. Only a fixed allowlist of transport/TLS codes can
  // survive runtimeLog; provider bodies, stacks and arbitrary code strings cannot.
  let failure: unknown = error;
  let failureCode: string | undefined;
  for (let depth = 0; depth < 3; depth++) {
    if (!(failure instanceof Error)) break;
    if ("code" in failure && typeof failure.code === "string") failureCode = failure.code;
    failure = failure.cause;
  }
  runtimeLog("oauth_start_failed", { category: "auth", status, stage, reason, failure_code: failureCode });
}
