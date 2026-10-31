---
name: Browser verification origins
description: Keep loopback-runner results separate from the proxied preview when diagnosing browser hydration failures.
---

Compare the browser origin before attributing hydration or repeated-reload failures to a UI change.

**Why:** loopback development browser checks repeatedly reloaded and left client controls disabled, while the same UI in the proxied Replit preview hydrated and worked. Reducing concurrency did not resolve it. A later reproduction recovered after a dev-server restart without application edits; the specific stale artifact was not recoverable, so do not claim an origin or component defect from that failure alone.

**How to apply:** record which origin each check exercised. Verify the actual preview independently when the runner fails, and report both results honestly. A passing proxied check does not mean the separate loopback suite passed. Investigate the runner without weakening authentication or CSP to make it green.

Self-managed browser checks should own their server and avoid inherited persisted compiler state; explicit preview checks should use the running workflow without starting another server.

**Why:** accepting an arbitrary existing server or its persisted compiler cache makes browser failures dependent on previous workspace sessions. Opting out only for the test server trades slower cold compilation for reproducibility, without changing preview or production caching.

**How to apply:** preserve this isolation when changing browser configuration. Capture real document requests, HMR metadata and browser errors before restarting a failing server; a restart can remove the evidence needed to identify the exact artifact. Do not count soft HMR history updates as document reloads.

Keep standalone-package verification separate from `next start` verification.

**Why:** an isolated standalone package produced self-redirects on unprefixed
Arabic routes while the same build's `next start` runner served both locales.
A passing production-server browser suite does not establish standalone
relocation correctness.

**How to apply:** report the runner actually tested and retain separate
standalone packaging checks before claiming that release form is verified.
