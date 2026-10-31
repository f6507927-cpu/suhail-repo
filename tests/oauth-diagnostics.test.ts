import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { logOAuthStartFailure } from "../src/lib/auth/oauth-diagnostics";
import { AuthError } from "../src/lib/auth/errors";
import { runtimeLog } from "../src/security/logger";

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

it.each([
  [new AuthError(502,"SECRET_FIXTURE"), "auth_rejected"],
  [new Error("Authentication environment validation failed. Check these variable names: SECRET_FIXTURE"), "auth_environment"],
  [new Error("invalid_oauth_destination"), "invalid_destination"],
  [Object.assign(new TypeError("SECRET_FIXTURE URL"),{code:"ERR_INVALID_URL"}), "invalid_url"],
  [new DOMException("SECRET_FIXTURE", "TimeoutError"), "timeout"],
  [new DOMException("SECRET_FIXTURE", "AbortError"), "timeout"],
  [new TypeError("fetch failed"), "fetch_failed"],
  [new Error("SECRET_FIXTURE stack, authorization and URL"), "unexpected"],
  ["SECRET_FIXTURE non-Error", "unexpected"],
])("classifies failure case %# without serializing its contents", (error, reason) => {
  logOAuthStartFailure("provider_check",error,500);
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage:"provider_check",reason,
  }));
});
it.each(["ENOTFOUND","ECONNREFUSED","CERT_HAS_EXPIRED","UNABLE_TO_VERIFY_LEAF_SIGNATURE"])("records only allowlisted transport code %s", code => {
  const cause = Object.assign(new Error("SECRET_FIXTURE cause"),{code});
  logOAuthStartFailure("provider_check",new TypeError("fetch failed",{cause}),500);
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage:"provider_check",reason:"fetch_failed",failure_code:code,
  }));
});
it("bounds cyclic causes and rejects arbitrary code strings", () => {
  const error = Object.assign(new Error("SECRET_FIXTURE"),{code:"SECRET_FIXTURE",cause:undefined as unknown});
  error.cause=error;
  logOAuthStartFailure("session_client",error,500);
  expect(console.error).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
    event:"oauth_start_failed",category:"auth",status:500,stage:"session_client",reason:"unexpected",
  }));
});
it("cannot inject messages or extra fields through the structured logger", () => {
  runtimeLog("oauth_start_failed", {
    status:500,category:"SECRET_FIXTURE",stage:"SECRET_FIXTURE",reason:"SECRET_FIXTURE",
    failure_code:"SECRET_FIXTURE",message:"SECRET_FIXTURE",cookie:"SECRET_FIXTURE",
    error:new Error("SECRET_FIXTURE"),url:"https://SECRET_FIXTURE",
  } as never);
  expect(console.error).toHaveBeenCalledExactlyOnceWith('{"event":"oauth_start_failed","status":500}');
});
it("does not log expected client-side origin rejections", () => {
  logOAuthStartFailure("origin_check",new AuthError(403,"invalid_origin"),403);
  expect(console.error).not.toHaveBeenCalled();
});
