import { isIP } from "node:net";

export type Category = "search" | "auth" | "api";
export const limits = {
  search: { capacity: 30, perMinute: 30 },
  auth: { capacity: 10, perMinute: 10 },
  api: { capacity: 20, perMinute: 60 },
} as const;

export function normalizedPath(input: string) {
  let path = input;
  for (let i = 0; i < 16; i++) {
    try {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    } catch { break; }
  }
  // Conservatively count aliases, even ones Next ultimately rejects/redirects.
  path = path.replaceAll("\\", "/").replace(/\/+/g, "/").toLowerCase();
  path = new URL(path, "https://routing.invalid").pathname;
  return path.replace(/^\/(?:ar|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
}
export function categoryFor(path: string): Category | undefined {
  const normalized = normalizedPath(path);
  if (normalized === "/search") return "search";
  if (/^\/auth(?:\/|$)/.test(normalized)) return "auth";
  if (/^\/api(?:\/|$)/.test(normalized)) return "api";
}
export function clientIdentity(forwarded: string | null) {
  const last = forwarded?.split(",").at(-1)?.trim() ?? "";
  if (!isIP(last)) return "unknown";
  return isIP(last) === 6 ? new URL(`http://[${last}]/`).hostname : last;
}

/** Per-process abuse reduction only; no distributed/global quota (D-129). */
export class TokenBuckets {
  private buckets = new Map<string, { tokens: number; time: number }>();
  constructor(private readonly maxEntries = 10_000) {}
  take(category: Category, identity: string, now = performance.now()) {
    const { capacity, perMinute } = limits[category];
    const key = `${category}:${identity}`;
    // Remove only fully refilled buckets; never evict an active budget to admit
    // an attacker-controlled identity. At capacity, new identities share overflow.
    if (!this.buckets.has(key) && this.buckets.size >= this.maxEntries) {
      for (const [entry, bucket] of this.buckets) {
        if (now - bucket.time >= 60_000) this.buckets.delete(entry);
      }
      if (this.buckets.size >= this.maxEntries) identity = "overflow";
    }
    const effectiveKey = `${category}:${identity}`;
    const bucket = this.buckets.get(effectiveKey) ?? { tokens: capacity, time: now };
    bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.time) * perMinute / 60_000);
    bucket.time = now;
    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(effectiveKey, bucket);
    return { allowed, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) * 60 / perMinute)) };
  }
}
export const applicationBuckets = new TokenBuckets();
export const limitHtml = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Too many requests</title><main><p lang="ar" dir="rtl">تجاوزت الحد المسموح من الطلبات، حاول مجددا لاحقا</p><p lang="en" dir="ltr">You have exceeded the request limit. Please try again later.</p></main></html>';
