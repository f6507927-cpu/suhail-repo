import { afterEach, expect, it, vi } from "vitest";
import { forwardingDiagnostic, logForwardingDiagnostic } from "../src/security/forwarding-diagnostic";
import { clientIdentity } from "../src/security/rate-limit";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it.each([
  [null, 0, "missing"], ["", 1, "invalid"], ["bad, ", 2, "invalid"],
  ["192.0.2.1", 1, "public_unknown"], ["a, 10.0.0.1", 2, "private"],
  ["::1", 1, "private"], ["fc00::123", 1, "private"], ["fe80::1", 1, "private"],
  ["::ffff:192.168.1.1", 1, "private"], ["::ffff:c0a8:101", 1, "private"],
  ["173.245.48.1", 1, "known_proxy_range"], ["2400:cb00::1", 1, "known_proxy_range"],
  ["::ffff:173.245.48.1", 1, "known_proxy_range"], ["2001:db8::1", 1, "public_unknown"],
  ["10.0.0.1:99", 1, "invalid"],
] as const)("classifies safely: %s", (input, count, classification) => {
  expect(forwardingDiagnostic(input)).toEqual({ entry_count: count, last_entry: classification });
});
it("is off by default; enabled logs contain only the fixed event, count and classification", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.stubEnv("FORWARDED_DIAGNOSTICS", undefined);
  logForwardingDiagnostic("private-secret, 10.0.0.1");
  expect(log).not.toHaveBeenCalled();
  vi.stubEnv("FORWARDED_DIAGNOSTICS", "1");
  const before = clientIdentity("private-secret, 10.0.0.1");
  logForwardingDiagnostic("private-secret, 10.0.0.1");
  expect(log).toHaveBeenCalledWith('{"event":"forwarding_diagnostic","entry_count":2,"last_entry":"private"}');
  expect(clientIdentity("private-secret, 10.0.0.1")).toBe(before);
});
