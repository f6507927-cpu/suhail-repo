---
name: Founder-approved stock-search planning budget
description: Scope of the agreed future coverage size and warm database-call latency target.
---

Plan public stock search for **10,000 total securities** and a **250 ms p95 warm
database-call budget**, not a hosted HTTP/page-response SLA.

**Why:** The founder explicitly selected both values after reviewing the disposable
PostgreSQL benchmark. Larger benchmark sizes were stress scenarios, not a request
to expand coverage or authorize a migration.

**How to apply:** Preserve the distinction between measured local-query performance
and hosted/concurrent performance. Reconfirm scope before using a larger coverage
forecast or a different latency budget. See `docs/SEARCH_PERFORMANCE.md` for the
measurement limitations; schema and production changes still need separate approval.
