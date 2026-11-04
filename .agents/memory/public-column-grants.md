---
name: Public column grants
description: Schema additions need explicit public-column privileges as well as RLS checks.
---

When an approved public projection adds a column, include its column-level SELECT grant in a new migration. Do not assume a generated ADD COLUMN expands the existing public grants.

**Why:** Public search passed mocked SQL tests but failed under the actual public role after a curated name column was added without its grant.

**How to apply:** Check grants and run public-role integration tests for schema/projection changes. Keep access limited to approved columns and never edit an already-applied migration.
