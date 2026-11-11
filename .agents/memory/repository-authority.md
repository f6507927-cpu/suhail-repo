---
name: Repository authority
description: Development is authoritative; decisions from an unmerged copy must not be reconstructed automatically.
---

Treat `development` as the source of truth. The founder confirmed that a separate
copy's auth-logging and standalone-deployment decisions never reached this
repository. Keep the current impact-report decision and existing deployment
build/run commands; do not recreate that standalone change.

**Why:** Earlier planning assumed the unmerged copy's decision numbers were
present here. The founder resolved the mismatch explicitly rather than asking
for those missing changes to be restored.

**How to apply:** Check the actual branch, code and decision log. Allocate new
decision numbers from this repository rather than treating numbers mentioned
from another copy as occupied.

## Branch and pull-request workflow

The repository blocks direct pushes to `development` and `master`. From now on,
work on a branch (for example `replit/<short-task-name>`), push that branch, and
open a pull request into `development`. Do not try to push directly to
`development` or `master`, and do not change the repository's branch rules.

**Why:** The founder explicitly requires this protected-branch workflow.

**How to apply:** Use a task branch for future work and submit changes through
a pull request targeting `development`.

## Supabase and deployment authorization

The founder requires: “No Supabase writes or deploy until I authorise.”
Approval of implementation or website wording is not permission to apply
migrations or change hosted data.

**Why:** The founder explicitly separated accepting the work from authorizing
database writes and deployment.

**How to apply:** Read-only schema inspection and isolated disposable-database
tests are allowed. Obtain explicit authorization before any Supabase write or
deployment; do not turn a missing-column error into permission to migrate.
