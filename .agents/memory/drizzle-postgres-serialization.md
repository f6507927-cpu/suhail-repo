---
name: Mixed Drizzle and postgres-js serialization
description: Raw JSON queries on the same postgres-js client used by Drizzle need explicit serialized JSON.
---

Do not assume raw postgres-js JSON helpers still use their original serializers after attaching Drizzle to that client.

**Why:** Drizzle replaces the client's JSON serializers for its own pre-serialized values. A later raw `sql.json(array)` query failed with a Buffer/string type error even though the JSON payload was valid.

**How to apply:** When mixing raw SQL and Drizzle on one connection, send raw JSON as `JSON.stringify(value)` with an explicit `::jsonb` cast, or perform the write entirely through Drizzle. Keep transaction/savepoint ownership with the layer that started it.
