---
name: Disposable integration bootstrap order
description: Why the database bootstrap suite must run first on a fresh disposable cluster.
---

Run the whole database suite against a fresh disposable PostgreSQL cluster and
keep its empty-target bootstrap check first. Do not relax that safety check.

**Why:** Vitest's duration/failure prioritization can put a newer integration
suite before bootstrap. If that suite applies migrations, the bootstrap correctly
refuses the now-nonempty schema even though the cluster was initially empty.
Repeated full runs also require a fresh cluster.

**How to apply:** Preserve explicit bootstrap ordering as suites are added;
restart the owned disposable test server before another full database run.
Never work around this by targeting Supabase or clearing a user's database.
