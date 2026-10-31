---
name: Validation startup budgets
description: Avoid false test failures from cold tooling startup under concurrent validation.
---

Separate heavyweight tooling initialization from behavioral test timeout budgets.

**Why:** Completion validation runs multiple checks concurrently. A cold Next/TypeScript ESLint configuration load exceeded the ordinary five-second assertion budget even though the same boundary suite passed when run independently.

**How to apply:** Initialize expensive lint/test tooling in suite setup with an explicit startup budget; retain normal assertion timeouts. Do not weaken assertions or raise every test's timeout to hide cold-start contention.

Bound test-worker concurrency when unit tests and engine coverage run alongside lint/typecheck.

**Why:** Independently passing engine tests and even a dedicated tooling setup hook can time out when all completion checks oversubscribe the workspace together. These failures did not indicate changed engine results.

**How to apply:** Reduce worker pressure before increasing assertion budgets. Test both the individual commands and the concurrent completion checks.

Even two workers per suite can oversubscribe the workspace when engine coverage
and the main suite start alongside TypeScript, ESLint and completion review.

**Why:** Existing hash-property and authorization-AST assertions timed out only
in the simultaneous completion run, while the ordinary unit run passed.

**How to apply:** Keep coverage and unit worker caps coordinated with the whole
validation fan-out; do not increase behavioral timeouts or reduce property runs
to hide machine contention.

Serialize browser-heavy verification even when fixture servers are independent.

**Why:** Several Chromium suites plus a Next production build exhausted the
workspace's process/thread allowance. Browsers crashed and Node failed to create
worker threads even though each suite could pass independently.

**How to apply:** Account for the workspace-wide thread budget, not only CPU
workers. Run browser/build suites serially with bounded workers after resource
failures; retain their assertions and do not treat launch crashes as app defects.
