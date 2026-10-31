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
