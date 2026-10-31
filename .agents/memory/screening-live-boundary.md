---
name: Live screening versus example fixtures
description: Founder boundary between local example-based tests and live financial research.
---

Example methodologies are not authority for screening live securities. Preview
site mode does not make real data a test dataset. The explicit development demo
seed is allowed to screen obviously fabricated demo issuers outside tests, but
only with explicitly selected preview mode and demo security, company,
methodology and version. The demo seed command also requires loopback storage;
preview mode alone never authorizes a remote seed.
Until a real production-enabled version exists, live bulk screening must do
nothing and say “No production methodology to screen with”.

**Why:** The founder explicitly distinguished permitted local integration examples
from live screening and required a no-op before production-methodology approval.

**How to apply:** Preserve this boundary when extending screening jobs, defaults
or launch flows. Preserve the narrowly scoped development-seed exception; never
extend it to manual/bulk live-security screening. Do not infer production approval
from public visibility or the preview environment.
