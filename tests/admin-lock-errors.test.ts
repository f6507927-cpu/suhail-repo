import { expect, it } from "vitest";
import { actionError, isLockTimeout } from "../src/lib/auth/errors";

it.each([
  { code: "55P03", message: "private database diagnostics" },
  { cause: { code: "55P03", message: "private database diagnostics" } },
])("maps lock timeout to the existing reload message, without diagnostics", error => {
  expect(isLockTimeout(error)).toBe(true);
  expect(actionError(error)).toEqual({
    ok: false, error: "The request failed. Reload the record and try again.", status: 503,
  });
});
it.each([null, undefined, "unknown", { code: "57014" }])("does not misclassify other failures", error => {
  expect(isLockTimeout(error)).toBe(false);
});
