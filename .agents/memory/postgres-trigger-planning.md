---
name: PostgreSQL trigger planning
description: Why successful trigger-function creation does not validate all SQL references.
---

Treat successful CREATE FUNCTION as insufficient validation of PL/pgSQL SQL
references. Exercise the guarded statement paths against the actual migrated
schema in a disposable database.

**Why:** SQL inside PL/pgSQL can be planned on first execution. A function can
therefore be created successfully while still referencing a nonexistent column;
the first write or explicit preflight query exposes the error.

**How to apply:** Keep migration application, initial guarded writes and refusal
cases in native PostgreSQL verification. Do not rely only on schema generation,
TypeScript checks or mocked SQL calls.
