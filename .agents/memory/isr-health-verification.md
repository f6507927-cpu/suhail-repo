---
name: ISR health verification
description: Distinguishing public-page availability from live database connectivity
---

Do not infer database health from a successful public-page response or a Next
startup-ready message. Classic ISR can serve healthy cached HTML while fresh
database reads fail.

**Why:** deliberate outage verification returned successful last-good pages with
all runtime database connection URLs absent.

**How to apply:** distinguish cached availability checks from explicit read probes
using the intended database role. Report them separately when investigating
connection, certificate or startup problems. A successful public build/read also
does not authorize migrations or demonstrate that private application reads work.
