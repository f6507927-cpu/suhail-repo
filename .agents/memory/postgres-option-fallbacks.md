---
name: Postgres option fallbacks
description: Non-obvious postgres-js credential fallback and IPv6 typing behavior.
---

An explicit empty password string does not prevent postgres-js from inheriting an ambient password. Supply a password function even for the deliberately empty-password case.

**Why:** postgres-js uses truthiness when resolving password options. An empty string falls through to the environment, while a function returning an empty string remains an explicit option.

**How to apply:** Verify the real driver's resolved connection options under conflicting ambient credentials, without opening a network connection. Do not assume passing an options object or a validated URL alone disables fallback.

Use the array-host form for IPv6 and isolate any necessary type assertion at the driver boundary.

**Why:** The driver's string-host parser splits on colons, while its runtime supports array hosts. Its public Options typings narrow host/port to scalars even though the implementation and parsed-options types support arrays.

**How to apply:** Keep the runtime array representation intact and cover IPv6 with resolved-options tests; do not replace it with a scalar merely to satisfy the public type declaration.

Preserve the callable SQL object itself when forwarding a client's public API.

**Why:** Unlike ordinary database methods, the SQL function owns named helpers and connection metadata. Binding it produces a new function without those properties; mock objects do not necessarily expose this failure.

**How to apply:** Verify the actual lazy client with a native driver, including named query helpers and shutdown, rather than relying solely on object-shaped mocks or a manually constructed guarded client.
