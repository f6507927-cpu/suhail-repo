---
name: Database CLI module boundaries
description: Node/tsx and Vitest resolve TypeScript modules differently; verify actual CLI commands.
---

Verify database commands by executing them, not only by importing their functions through Vitest.

**Why:** Vitest handled top-level await and schema exports successfully while tsx initially compiled CLI scripts as CommonJS. Marking only the runner as ESM then made namespace imports of the CommonJS schema expose a default wrapper rather than its tables.

**How to apply:** Keep database tooling and schema code in compatible module scopes. A scoped ESM boundary avoids converting the entire Next project. After boundary changes, check actual migrate/seed commands and schema generation as well as tests.
