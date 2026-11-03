---
name: SEC Notes fiscal context
description: Why FSN offsets identify contexts rather than reconstructing fiscal dates.
---

Treat companyfacts' selected annual fiscal dates as authoritative. Do not guess
an offset-to-date conversion from NUM `datp`/`durp`; preserve them as numeric
context identifiers anchored to one matching annual revenue row and accession.

**Why:** The documentation's fractional offset example and the owner's dry-run
values did not establish a single safe conversion. Guessing an offset unit could
pair the wrong context while appearing to fix rounded month-end dates.

**How to apply:** Keep filing identity, normalized fiscal end and revenue anchoring
strict. Any future offset decoder needs archive-format evidence and fixtures,
not a conversion inferred from decimal appearance.
