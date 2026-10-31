import { privateCsp } from "../lib/auth/csp";

export const securityHeaders = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** D-40/D-51: fixed public policy; never add request reads to ISR rendering. */
export function publicCsp(url: string | undefined, development: boolean) {
  return privateCsp("unused", url, development)
    .replace("'nonce-unused' 'strict-dynamic'", "'unsafe-inline'");
}

export function secureResponse<T extends Response>(response: T, preview: boolean, nextStatic = false) {
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set("Content-Security-Policy",
      publicCsp(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development"));
  }
  if (preview) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    // Keep Next's internal ISR cache; preserve preview downstream no-store
    // independently of the removed Basic Auth requirement (D-137).
    if (!nextStatic || response.status >= 400) noStore(response);
  }
  return response;
}

export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  return response;
}
