---
name: Mixed Drizzle and postgres-js serialization
description: Raw JSON queries on the same postgres-js client used by Drizzle need explicit serialized JSON.
---

Do not assume raw postgres-js JSON helpers still use their original serializers after attaching Drizzle to that client.

**Why:** Drizzle replaces the client's JSON serializers for its own pre-serialized values. A later raw `sql.json(array)` query failed with a Buffer/string type error even though the JSON payload was valid.

**How to apply:** For raw writes that must work with either native or Drizzle-modified serializers, send `JSON.stringify(value)` as `::text::jsonb`, or perform the write entirely through Drizzle. The intermediate text cast prevents native postgres-js from JSON-encoding an already serialized string when parameter type inference sees `::jsonb`; without it a fixture array can become a JSON string. Keep transaction/savepoint ownership with the layer that started it.
