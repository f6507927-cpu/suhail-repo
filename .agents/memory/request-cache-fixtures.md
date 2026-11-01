---
name: Request-cache fixture isolation
description: Avoiding false-negative React memoization tests outside Next's initialized request context.
---

A standalone Next edge RSC renderer needs the global `AsyncLocalStorage`
constructor installed before its module loads, just as Next initializes it.
Use a real request-render context, not merely an async function or a mock
`cache` wrapper, to establish request-local deduplication.

**Why:** Without Next's initialization, the standalone renderer lost its cache
context across `await`, making correctly cached guards appear to verify
repeatedly. Checking the real generated Next HTTP renderer separately confirmed
the request-local behavior.

**How to apply:** Keep isolated renderer tests aligned with the installed
framework's initialization, and retain a real HTTP render/action distinction.
Do not treat a renderer setup failure as evidence to introduce a global auth
cache. Action execution must be measured outside a render pass.

Keep a fixture session's token stable for the whole request scenario.

**Why:** Real RSC rendering can cross a wall-clock second. Regenerating a JWT
for the expected value can change its time claims and falsely fail an exact-token
assertion even though verification and request caching are correct.

**How to apply:** Mint once per scenario and compare the actual cookie token;
retain fresh session state between scenarios and leave runtime auth unchanged.
