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

Parallel custom migrations can reserve the same numeric prefix. Inspect the
live registry read-only before renumbering anything; only renumber unapplied
feature migrations. Preserve SQL checksums and timestamps, shift the associated
snapshot filenames without changing their identity chain, and regenerate unique
journal indexes. Regenerate Arabic inventories from the combined source rather
than choosing one branch's generated rows.

**Why:** Main can gain another pending migration during completion-time syncing;
a conflict-free textual merge can still leave duplicate journal indexes.

**How to apply:** Verify both migrations survive, keep applied migration files
unchanged, then test the combined migration chain against disposable PostgreSQL.

Decision numbers are also a shared registry. Recheck their uniqueness after a
completion-time synchronization, even if the decision log merged without markers.
Renumber only the unpublished task-local decision when a newer main-project
approval already owns its number; preserve the main approval and historical pins.

**Why:** Concurrent additions under different headings can merge cleanly while
silently reserving the same decision number for unrelated approvals.

**How to apply:** Check the combined decision log before finishing, then update
the task's own references consistently without relabeling another approval.
