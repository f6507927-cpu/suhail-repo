---
name: Security browser budget isolation
description: Verify real Next prefetch accounting without hiding repeated-navigation failures.
---

Keep security limiters enabled in production browser fixtures. Test repeated
page views followed by sign-in with one unchanged client identity and no bucket
resets. Independent test scenarios may have independent identities.

**Why:** Automatic auth prefetch previously exhausted sign-in attempts during
ordinary browsing. Synthetic proxy unit requests then passed an exemption test
while the real Next production adapter stripped the relevant header, so the
hosted-style path still spent tokens. A unit assertion alone is insufficient.

**How to apply:** Verify header-dependent accounting through the actual Next
server as well as direct proxy tests. Never rotate identities to make sustained
browsing pass, add runtime test bypasses, or describe synthetic forwarded
headers as verification of hosted forwarding. Follow the current founder-approved
prefetch policy rather than the superseded rule that counted all prefetches.
