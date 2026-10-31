---
name: Structural merge conflicts
description: Check unmarked code as well as conflict markers when reconciling structurally merged files.
---

Compare the whole conflicted file with both intact staged versions, not just
the marked region.

**Why:** A structural merge marked a small conflict but also misplaced statements
and dropped declarations elsewhere in the file, outside the conflict markers.
Deleting markers alone would have left syntactically broken test logic.

**How to apply:** Preserve both sets of functionality using an intact version as
the base when needed. Parse/typecheck the result and run the affected checks
before finishing reconciliation.

A completion-time synchronization can introduce newer main-project edits after
the working tree was tested. Treat those earlier passing checks as evidence for
the pre-sync tree only. Reconcile against the latest intact main versions,
preserve both behaviors, and validate the exact combined files again.
