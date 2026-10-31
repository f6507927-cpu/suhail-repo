---
name: Locale navigation and early theme
description: Why locale switches must rerun the early theme restoration script.
---

Use document navigation when switching between locale-owned root layouts.

**Why:** Next's client navigation between locales can replace the root HTML's class with the server's dark default without executing its inline head script. A saved light choice then disappears until reload.

**How to apply:** Generate the same-path destination through locale-aware routing, but navigate as a full document when changing locale. Keep a browser regression for persisted light mode across locale switches.
