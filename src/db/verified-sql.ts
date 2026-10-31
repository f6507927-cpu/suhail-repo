import type { Sql } from "postgres";

type RuntimeCredential = "DATABASE_URL_APP" | "DATABASE_URL_PUBLIC";

/**
 * Gate the public postgres-js execution APIs, rather than making Drizzle's
 * synchronous query builders asynchronous. No business query is sent until
 * the identity promise succeeds. Failures poison this client and close it.
 */
export function verifyRuntimeRole(sql: Sql, key: RuntimeCredential): Sql {
  const expected = key === "DATABASE_URL_APP" ? "suhail_app" : "suhail_public";
  let identity: Promise<void> | undefined;
  function ready() {
    return (identity ??= (async () => {
      try {
        const rows = await sql.unsafe("select current_user");
        if (rows.length !== 1 || rows[0].current_user !== expected)
          throw new Error("role mismatch");
      } catch {
        try {
          await sql.end({ timeout: 0 });
        } catch {
          /* Refusal remains sticky. */
        }
        // Driver errors can contain connection details; do not expose causes.
        throw new Error(
          `Database identity verification failed. Check variable name: ${key}`,
        );
      }
    })());
  }

  function guardedQuery<T>(query: T): T {
    if (!query || typeof query !== "object" || !("then" in query)) return query;
    let execution: Promise<unknown> | undefined;
    const wait = () => (execution ??= ready().then(() => query));
    const proxy = new Proxy(query, {
      get(target, property) {
        if (
          property === "then" ||
          property === "catch" ||
          property === "finally"
        )
          return (...args: unknown[]) => {
            const promise = wait();
            return Reflect.apply(Reflect.get(promise, property), promise, args);
          };
        const method = Reflect.get(target, property);
        if (typeof method !== "function") return method;
        if (property === "execute" || property === "forEach")
          return (...args: unknown[]) => {
            execution ??= ready().then(() =>
              Reflect.apply(method, target, args),
            );
            // Explicit execution can be fire-and-forget. Awaiters still receive
            // the original rejection; no unhandled rejection escapes refusal.
            void execution.catch(() => {});
            return proxy;
          };
        if (property === "readable" || property === "writable")
          return (...args: unknown[]) =>
            ready().then(() => Reflect.apply(method, target, args));
        return (...args: unknown[]) => {
          const result = Reflect.apply(method, target, args);
          if (result === target) return proxy; // values/raw/simple/describe/cancel
          if (property === "cursor" && result?.[Symbol.asyncIterator]) {
            return {
              [Symbol.asyncIterator]() {
                const iterator = result[Symbol.asyncIterator]();
                return {
                  next: (...values: unknown[]) =>
                    ready().then(() => iterator.next(...values)),
                  return: (...values: unknown[]) =>
                    iterator.return?.(...values),
                  [Symbol.asyncIterator]() {
                    return this;
                  },
                };
              },
            };
          }
          return result;
        };
      },
    });
    return proxy;
  }

  return new Proxy(sql, {
    apply(target, thisArg, args) {
      return guardedQuery(Reflect.apply(target, thisArg, args));
    },
    get(target, property) {
      const method = Reflect.get(target, property);
      if (typeof method !== "function") return method;
      // Shutdown never needs to open/verify a connection.
      if (property === "end") return method.bind(target);
      if (
        [
          "begin",
          "reserve",
          "listen",
          "subscribe",
          "file",
          "largeObject",
          "notify",
        ].includes(String(property))
      )
        return (...args: unknown[]) =>
          ready().then(() => Reflect.apply(method, target, args));
      return (...args: unknown[]) =>
        guardedQuery(Reflect.apply(method, target, args));
    },
  });
}
