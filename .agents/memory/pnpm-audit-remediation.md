---
name: pnpm audit remediation
description: Interpreting pnpm automatic audit fixes and nested module-only manifests.
---

Check the actual files written by `pnpm audit --fix`, not just its console
description. Running it in a nested module-only manifest directory can reuse
the ancestor project's lockfile and write overrides at the ancestor root.

**Why:** The console description can misidentify the modified configuration
file and make shared dependency graphs look like independent installations.

**How to apply:** Identify the owning lockfile before treating nested manifests
as independent projects. Keep override configuration available anywhere a
frozen install runs, including isolated dependency stages in release builds.
