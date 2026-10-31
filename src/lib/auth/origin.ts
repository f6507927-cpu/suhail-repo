import "server-only";
import { AuthError } from "./errors";

function configuredOrigin(value: string | undefined) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new AuthError(503, "invalid_auth_origin");
  return url.origin;
}

// D-46: callback origins come from deployment configuration, never forwarded headers.
export function authOrigin(request?: Request) {
  const site = configuredOrigin(process.env.SITE_URL);
  const development = process.env.NODE_ENV === "development";
  const preview = development && process.env.REPLIT_DEV_DOMAIN
    ? configuredOrigin(`https://${process.env.REPLIT_DEV_DOMAIN}`) : null;
  if (!request) {
    const canonical = preview ?? site;
    if (!canonical) throw new AuthError(503, "auth_origin_not_configured");
    return canonical;
  }
  const incoming = new URL(request.url);
  const host = request.headers.get("host");
  if (host && preview && host === new URL(preview).host) return preview;
  if (host && site && host === new URL(site).host) return site;
  if (incoming.origin === site || incoming.origin === preview) return incoming.origin;
  // Local browser suites/development only; this never permits arbitrary hosts in production.
  if (development && incoming.protocol === "http:" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(incoming.hostname)) {
    // Next rewrites may normalize 127.0.0.1 to localhost. Only loopback aliases
    // on the same port are accepted, not arbitrary Host/Origin/forwarded values.
    for (const value of [host ? `http://${host}` : null, request.headers.get("origin")]) {
      if (!value) continue;
      try {
        const local = new URL(value);
        if (local.protocol === "http:" && !local.username && !local.password &&
            ["localhost","127.0.0.1"].includes(local.hostname) && local.port === incoming.port) return local.origin;
      } catch { /* Invalid authority is not an allowed local alias. */ }
    }
    if (["localhost","127.0.0.1"].includes(incoming.hostname)) return incoming.origin;
  }
  const origin = preview ?? site;
  if (!origin) throw new AuthError(503, "auth_origin_not_configured");
  return origin;
}
