# Public search protection

## Status and approved policy

**Prepared locally, not active on any deployed site.** The founder confirmed that
Cloudflare is not ready. This work neither publishes the app nor configures a
zone, buys a plan, edits DNS, changes origin access or calls Cloudflare's API.
There is no new search API. D-136 subsequently authorizes a local application
limiter: a token bucket per process and client, search refill 30/60s and capacity
30, shared across locales. It is not the Cloudflare fixed 60-second block:
one search token returns every two seconds and Retry-After describes refill.
Instances/restarts have independent budgets. Identity uses only the trimmed LAST
X-Forwarded-For entry, assumed appended by the platform; invalid/missing entries
share an unknown budget. No other IP headers are trusted. This assumption is
not verified platform forwarding or direct-origin protection.

D-129 approves 30 requests per IP per 60 seconds across both locales, then a
60-second HTTP 429 block. Approved failure messages:

- AR: `تجاوزت الحد المسموح من الطلبات، حاول مجددا لاحقا`
- EN: `You have exceeded the request limit. Please try again later.`

Use **one** rate-limit rule and a small bilingual, script-free HTML response
(Arabic RTL, English LTR). Two locale-specific rules would create separate
counters and permit twice the intended traffic. The response deliberately
contains no query, client IP, financial data, external assets or cookies.

This protects **query-driven SSR**, not an API. Match `/search`, `/en/search`,
trailing-slash variants and `/ar/search` redirects. Lowercase/recursively decoded
paths cover encoded aliases. Query values and `?_rsc=...` do not affect identity.
All methods and queries count; there are no exemptions for empty/invalid input,
prefetch headers, cookies, claimed IP headers, or verified bots. IP is the trusted
Cloudflare `ip.src`, not `X-Forwarded-For` or a browser-supplied header.

Cloudflare requires `cf.colo.id` in addition to `ip.src`. Counters are scoped by
data center (with regional sharing described by Cloudflare), with possible
seconds of enforcement delay. **This is abuse reduction, not an exact global
30-query ceiling.** Shared office/mobile-network IPs can share the budget.
Changing locale, query or cookies must not reset it.

## Configuration artifacts

`ops/cloudflare/search-rules.json` contains three **individual rule objects**,
keyed by their Rulesets API phases. All ship with `enabled: false`.

| Phase | Purpose |
| --- | --- |
| `http_ratelimit` | One 30/60 rule, block for 60 seconds, custom HTTP 429 |
| `http_request_cache_settings` | Bypass edge caching only for search paths |
| `http_response_headers_transform` | Search-only `private, no-store, max-age=0`, CDN no-store and `X-Robots-Tag: noindex, follow`, including edge errors |

The normal search document already exports `force-dynamic` and `noindex, follow`.
The edge error also has an HTML `noindex, nofollow` directive. Cache bypass is
separate from response headers: header transformation alone does **not** change
Cloudflare's cache eligibility. No synthetic `Retry-After` countdown is claimed:
the standard rate-limit custom-response object exposes status/type/body, not
arbitrary response headers; the approved message makes no exact-time promise.

The proxy now applies the preview gate and D-136 local budgets before public
localization, without public session inspection. Database loaders and public
renderers remain request-cookie/header-free. Home, stock and methodology routes
keep 900-second ISR. A bounded map retains active budgets; excess new identities
share a category-specific overflow budget instead of evicting active clients.

## Activation requires a separate approval

Do not run a whole-ruleset PUT or apply this JSON as a single request. It is a
reviewable template, not an automatic deployment script.

1. Obtain founder approval for domain/Cloudflare setup and any paid plan. The
   current Cloudflare plan matrix requires **Pro or higher** for the approved
   60-second counting and mitigation periods; Free only offers 10 seconds for
   both. Do not silently substitute a different traffic policy. Confirm the
   actual account accepts the expression/functions and custom response.
2. Confirm domain ownership, proxied hostnames, TLS and trusted routing. Enable
   Cloudflare URL normalization for incoming requests **and to origin**, using
   consistent normalization so slash, dot-segment and encoded aliases cannot
   reach a search renderer via an unmatched path. Validate with Cloudflare Trace.
3. Close direct-origin bypass for **every** public origin hostname, including
   platform-provided aliases, using an approved origin-access arrangement. A
   hidden hostname or forged `CF-Connecting-IP` header is not access control.
   Choose and approve a compatible origin restriction separately; none is
   assumed to exist in this app. If origin access cannot be restricted, record
   that the edge does not fully protect database traffic and do not declare
   launch protection complete.
4. On a separately approved test zone/hostname, inspect each phase's existing
   entry-point ruleset. Create a ruleset only if absent; otherwise append the
   corresponding individual rule without replacing existing security/cache
   rules. Save previous rule IDs/settings for rollback. The templates are
   zone-scoped and cover any matching path on that zone: use a dedicated zone,
   or narrow all three expressions to approved hostnames if the zone hosts
   unrelated applications. Hostname narrowing must not split the counter.
5. Explicitly enable all three rules after approval. Check ordering: no earlier
   skip/allow rule should bypass search protection; no later cache or response
   transform rule may override its bypass/no-store/noindex. Do not cache HTML
   search responses, redirects, RSC responses or 429s, even with Cache Everything.
   Configure WAF/bot features without an unapproved cookie/challenge-based
   replacement for the approved plain block response.
6. Run the real-edge acceptance checks below. In particular, verify that the
   account applies response transforms to the custom WAF block response. If
   headers are absent or the API rejects any setting, stop activation and resolve
   the configuration; the local model is not evidence of edge behavior.
7. Only after approval and passing checks, enable on the launch hostname. Observe
   429 rate, origin request volume and shared-IP false positives. Do not log raw
   search queries or IPs into application analytics just to count blocks.

Rollback, if separately authorized: disable only the newly added rate-limit
rule by its saved ID. Keep search no-store/noindex protection; do not disable WAF
globally or replace unrelated rules. Changing an overly restrictive threshold
still requires founder approval.

## Verification and its limits

### Automated local checks

- `pnpm exec vitest run tests/search-edge.test.ts`: validates the disabled
  artifacts, exact approved constants/copy, canonical/encoded/locale variants,
  shared identity, spoofed headers, normal traffic, block duration/recovery,
  origin short-circuit and unrelated-route cache preservation.
- With an **owned, fresh disposable PostgreSQL 17** cluster from
  `pnpm db:test:up` on loopback port 55432, run
  `pnpm exec playwright test --config playwright.search.config.ts`.
  The existing setup migrates/seeds only this disposable database, builds an
  ignored Next copy with the restricted local public-role adapter, and starts
  Next on 3500. New browser tests start a test-only HTTP gateway on loopback
  3501 in front of those real SSR routes.
- Both locales submit real GET forms through this gateway; query-dependent
  results, normal search noindex/no-store/no-cookie, a shared 30-request budget,
  bilingual 429, upstream short-circuit, recovery and sibling ISR are checked.
  Existing direct-origin tests continue to verify search behavior without
  relying on the gateway's added headers.
- `tests/search-edge/fixture.ts` is a **deterministic single-colo policy model**,
  not Cloudflare's rule engine or timing algorithm. It consumes the checked-in
  rule expression/constants/response/header values. Its fake clock and reset are
  local test controls, not runtime routes or privileged-header bypasses.
- Standard typecheck, lint, logical lint and unit tests remain required.

### Real-edge checks still required before activation

From a controlled client on the approved test hostname:

1. Submit home and header GET forms in AR and EN below the limit; confirm correct
   results, HTTP 200, noindex, no-store and no unexpected session cookies.
2. Mix the two locale paths, new query values, HEAD and RSC/prefetch requests.
   Confirm a shared counter in Cloudflare security events. Allow for documented
   propagation delay rather than asserting exactly request 31 at the origin.
3. Confirm HTTP 429, both exact approved messages with correct text direction,
   `Cache-Control`/CDN no-store, `X-Robots-Tag: noindex`, and no cached error replay
   to a second client. Check cache status and actual origin request counts.
4. Try locale/trailing-slash/percent-encoded/repeated-slash/dot-segment aliases
   and forwarded-IP/cookie/prefetch spoofing. None may reach the database with a
   fresh budget. Check direct-origin hostnames are actually inaccessible.
5. Confirm searches recover after mitigation, and home/stock/methodology remain
   usable and ISR-cacheable in both locales while search is blocked.
6. Record plan, expression validation, rule IDs, test hostname, observed headers,
   counter behavior and approvals without committing tokens, IPs or credentials.

### Local results — 16 October 2026

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm lint` / `pnpm lint:logical` | Passed |
| `pnpm test` | 935 tests passed, including 28 edge-policy assertions |
| `playwright.search.config.ts`, Chromium | All 7 tests passed against disposable PostgreSQL 17 and the isolated production Next build |
| Search screenshot | Empty-query Arabic search rendered successfully in the isolated Next app |

The browser suite proves the local policy contract in front of real SSR,
including both locales' GET forms, 429 short-circuit, timed recovery and unchanged
ISR headers. It does not validate a Cloudflare account, remote edge enforcement,
origin access restrictions, Safari/Firefox or production. No live database was
migrated or seeded. No dependencies or application runtime changes were added.
Both Vitest suites cap workers at one: simultaneous completion coverage, unit,
typecheck and lint runs otherwise caused existing hash-property and authorization
AST tests to exceed their unchanged five-second budgets under CPU contention.

### Cloudflare sources

Consulted 16 October 2026; recheck account availability at activation:

- [Rate limiting availability and enforcement caveats](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Rate limiting parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)
- [Counter/data-center scope](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/)
- [Individual rule creation and custom block response](https://developers.cloudflare.com/waf/rate-limiting-rules/create-api/)
- [Response transforms, including Cloudflare errors](https://developers.cloudflare.com/rules/transform/response-header-modification/)
- [Rules language functions](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/)
