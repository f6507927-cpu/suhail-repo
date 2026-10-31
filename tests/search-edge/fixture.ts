import rules from "../../ops/cloudflare/search-rules.json";

// TEST ONLY: a deterministic single-colo policy model, NOT a Cloudflare emulator
// or an application fallback limiter. No src/ module may import this fixture.
// Disabled templates are deliberately simulated as enabled only in local tests.
const expression = rules.http_ratelimit.expression;
const match = /^lower\(url_decode\(http\.request\.uri\.path, "r"\)\) in \{((?:"[^"]+" ?)+)\}$/.exec(expression);
if (!match) throw new Error("Update the local policy model for the new WAF expression");
const paths = new Set([...match[1].matchAll(/"([^"]+)"/g)].map(m => m[1]));
export function matchesSearch(url: string) {
  let path = new URL(url).pathname;
  // Model recursive percent decoding for ASCII route aliases, not query strings.
  for (;;) {
    const decoded = path.replace(/%([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\+/g, " ");
    if (decoded === path) break;
    path = decoded;
  }
  return paths.has(path.toLowerCase());
}

export function createSearchEdgeFixture(
  upstream: (request: Request) => Promise<Response>,
  now: () => number = Date.now,
) {
  const buckets = new Map<string, { start: number; count: number; blockedUntil: number }>();
  const policy = rules.http_ratelimit.ratelimit;
  function headers(response: Response) {
    const result = new Headers(response.headers);
    for (const [name, setting] of Object.entries(rules.http_response_headers_transform.action_parameters.headers))
      result.set(name, setting.value);
    return new Response(response.body, { status: response.status, headers: result });
  }
  return {
    reset: () => buckets.clear(),
    // Identity comes from trusted transport in the HTTP fixture, never a header.
    async handle(request: Request, ip: string, colo = "local") {
      if (!matchesSearch(request.url)) return upstream(request);
      const time = now();
      const key = JSON.stringify([colo, ip]);
      let bucket = buckets.get(key);
      if (!bucket || (bucket.blockedUntil <= time && time - bucket.start >= policy.period * 1000)) {
        bucket = { start: time, count: 0, blockedUntil: 0 };
        buckets.set(key, bucket);
      }
      if (bucket.blockedUntil <= time && ++bucket.count > policy.requests_per_period)
        bucket.blockedUntil = time + policy.mitigation_timeout * 1000;
      if (bucket.blockedUntil > time) {
        const response = rules.http_ratelimit.action_parameters.response;
        return headers(new Response(request.method === "HEAD" ? null : response.content, {
          status: response.status_code,
          headers: { "content-type": `${response.content_type}; charset=utf-8` },
        }));
      }
      return headers(await upstream(request));
    },
  };
}
