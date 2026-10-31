import { BlockList, isIP } from "node:net";

const privateRanges = new BlockList();
for (const [network, prefix] of [["10.0.0.0", 8], ["127.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["169.254.0.0", 16]] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
privateRanges.addAddress("::1", "ipv6");
privateRanges.addSubnet("fc00::", 7, "ipv6");
privateRanges.addSubnet("fe80::", 10, "ipv6");
// Deliberately finite subset of Cloudflare ranges, NOT a trusted-proxy policy.
const knownProxyRanges = new BlockList();
knownProxyRanges.addSubnet("173.245.48.0", 20, "ipv4");
knownProxyRanges.addSubnet("2400:cb00::", 32, "ipv6");

export function forwardingDiagnostic(forwarded: string | null) {
  const entries = forwarded === null ? [] : forwarded.split(",");
  const last = entries.at(-1)?.trim() ?? "";
  const version = isIP(last);
  const family = version === 6 ? "ipv6" : "ipv4";
  const classification = forwarded === null ? "missing" : !version ? "invalid"
    : privateRanges.check(last, family) ? "private"
    : knownProxyRanges.check(last, family) ? "known_proxy_range" : "public_unknown";
  return { entry_count: entries.length, last_entry: classification };
}

/** Temporary opt-in diagnostic; never include the input or client identity. */
export function logForwardingDiagnostic(forwarded: string | null) {
  if (process.env.FORWARDED_DIAGNOSTICS !== "1") return;
  console.info(JSON.stringify({ event: "forwarding_diagnostic", ...forwardingDiagnostic(forwarded) }));
}
