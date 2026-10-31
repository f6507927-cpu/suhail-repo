---
name: Public search edge boundary
description: Why local search-protection verification and live edge activation must remain separate.
---

Treat the approved public-search policy as an edge configuration contract, not
permission to enable infrastructure or add an application-process limiter.
Consult D-129 in `docs/DECISIONS.md` and the activation checklist in
`docs/PUBLIC_SEARCH_PROTECTION.md` before changing enforcement.

**Why:** The founder approved traffic limits and bilingual block copy while
separating local preparation from Cloudflare setup. Cloudflare counters are
regional/data-center scoped and delayed; a passing deterministic local model
cannot establish an exact global database-query ceiling or eliminate direct
origin bypass.

**How to apply:** Preserve the shared locale budget, verify actual account
capabilities and origin restrictions under separate approval, and distinguish
local SSR tests from real-edge evidence in handoffs. Never silently substitute
a different policy just to fit a cheaper plan.
