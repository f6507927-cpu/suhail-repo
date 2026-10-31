---
name: Next browser database boundary
description: Why local public-role browser checks need an isolated connection adapter, not a weaker runtime guard.
---

Keep the production connection boundary unchanged. For real Next browser tests
against disposable PostgreSQL, substitute only the public connection factory in
an ignored generated copy, using the strict loopback TEST parser and the real
public-role identity verification. Keep public loaders, SQL, RLS, routes and
authentication unchanged.

**Why:** Next compiles `process.env.NODE_ENV` as development/production;
launching Next with `NODE_ENV=test` does not activate test-only destination/TLS
exceptions in compiled application modules. A loopback refusal is correct, not
a reason to relax the actual application's host policy.

**How to apply:** Follow the existing isolated browser-runner pattern. Strip
inherited database/provider credentials from the generated app. Distinguish
public-role integration coverage and copied-app browser results from any
verification against a live Supabase deployment.
