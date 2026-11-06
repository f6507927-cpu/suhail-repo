/**
 * Demo, example and synthetic content never reaches a public page on any
 * deployment, preview or live. Production runs SITE_MODE=preview (D-24), so
 * SITE_MODE alone cannot be the gate. Only local fixture servers and tests may
 * opt in, explicitly, and only on a reserved or loopback SITE_URL host.
 * Public pages read no cookies or headers (D-20/D-22); this reads only env.
 */
const reservedSuffixes = [".test", ".localhost", ".invalid"];
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function publicDemoContentVisible(env: Record<string, string | undefined> = process.env): boolean {
  if (env.PUBLIC_DEMO_FIXTURES !== "1" || env.SITE_MODE === "live") return false;
  let host: string;
  try { host = new URL(env.SITE_URL ?? "").hostname.toLowerCase(); } catch { return false; }
  return loopback.has(host) || reservedSuffixes.some(suffix => host.endsWith(suffix));
}
