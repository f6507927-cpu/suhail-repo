---
name: Installed dependencies after task sync
description: Task syncing can update package declarations without updating installed modules.
---

Treat the committed lockfile and installed dependency tree as separate state after syncing a task with main.

**Why:** Completion syncing brought in a security patch and its regression test while the workspace still executed the older installed dependency. The unchanged test passed after the installed tree matched the committed lockfile.

**How to apply:** When incoming work changes dependencies, refresh the installed tree with a frozen-lockfile install and verify actual runtime resolution before diagnosing the resulting failures as code regressions. Do not weaken security assertions to accommodate stale installed packages.
