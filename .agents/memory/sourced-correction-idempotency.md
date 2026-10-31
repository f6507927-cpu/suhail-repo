---
name: Sourced correction idempotency
description: Why duplicate detection must use effective evidence rather than matching history.
---

Deduplicate sourced corrections against the currently effective evidence,
not against any matching historical row.

**Why:** A legitimate 10 → 13 → 10 correction must restore 10. Finding its old
historical row and treating the submission as a no-op leaves 13 and its derived
screening denominator in force. An analyst can also correct the actual trading
date while retaining the same attested calendar month.

**How to apply:** Check both the daily and attested-month observation scopes.
Test reversals, selected evidence IDs, refreshed derived values, and a repeated
submission of the final effective correction that creates no further records.
Keep correction ordering consistent with the timestamp precision exposed by
the database driver.
