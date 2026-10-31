---
name: Next route type caches
description: Distinguishing stale generated validator failures from application type errors after route changes.
---

Check generated route validators before changing source code to fix post-merge missing-page or missing-layout errors.

**Why:** Next.js maintains separate build and development route types. Both can be included in TypeScript checking, and generating fresh build types alone does not remove stale development validators. Moving routes under locale layouts can therefore leave references to removed root routes.

**How to apply:** When the missing imports originate in generated validators, refresh both generated type directories and run Next's type generation before checking TypeScript. Keep strict checking enabled; do not exclude route validators to hide stale-cache failures.

Starting the development server and TypeScript checking simultaneously can also
produce transient TS6053 errors for generated development type files.

**Why:** Next replaces those files during startup; the checker can capture paths
while the files are being removed and regenerated.

**How to apply:** Wait for the development server to finish startup before
checking types. Serialize development startup, production builds and browser
test servers rather than changing source types to mask a generated-file race.
