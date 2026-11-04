---
name: Database CLI module boundaries
description: Node/tsx and Vitest resolve TypeScript modules differently; verify actual CLI commands.
---

Verify database commands by executing them, not only by importing their functions through Vitest.

**Why:** Vitest handled top-level await and schema exports successfully while tsx initially compiled CLI scripts as CommonJS. Marking only the runner as ESM then made namespace imports of the CommonJS schema expose a default wrapper rather than its tables.

**How to apply:** Keep database tooling and schema code in compatible module scopes. A scoped ESM boundary avoids converting the entire Next project. After boundary changes, check actual migrate/seed commands and schema generation as well as tests.

Native runtime-CLI tests must exercise the real database-role identity guard,
not weaken it or assume that a test environment bypasses it.

**Why:** In-process tests could use `SET ROLE`, while a child CLI had to
authenticate as the runtime role. Those are different capabilities; passing
the former did not prove that the command could connect.

**How to apply:** Supply the required identity only in disposable loopback
fixtures, restore any cluster-wide fixture settings, and keep live role/auth
settings untouched. Use a separate disposable database when read-only command
tests require committed prerequisites, so append-only audit fixtures need no
deletion bypass or cross-suite contamination.

Browser fixture setup also needs the existing runner's `react-server` condition when it imports server-only services. Preserve both the scoped ESM boundary and this launch condition when extending a fixture harness.

**Why:** Fixing ESM compilation alone can expose a separate `server-only` import failure in the actual Node entrypoint; Vitest's mocks do not prove that entrypoint starts.

Next's configuration also runs in ordinary Node, not the React server condition. Do not import a `server-only` environment module there; keep public configuration validation in a pure shared helper.

**Why:** Type checking and mocked unit imports can pass while the actual development server fails to load its configuration.
