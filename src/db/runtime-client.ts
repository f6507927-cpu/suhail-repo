import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { connectDatabase } from "./connect";
import { verifyRuntimeRole } from "./verified-sql";

export const runtimeOptions = {
  prepare: false,
  max: 3,
  // D-139: Session pooler safety; not a substitute for server-side timeouts.
  max_lifetime: 1800,
  keep_alive: 30,
  idle_timeout: 20,
  connect_timeout: 10,
} as const;
export function lazyRuntimeClient(
  key: "DATABASE_URL_PUBLIC" | "DATABASE_URL_APP",
) {
  const create = () => {
    const sql = connectDatabase(key, runtimeOptions);
    return drizzle(verifyRuntimeRole(sql, key), { schema });
  };
  let client: ReturnType<typeof create> | undefined;
  // No environment reads or connections during module import / Next build.
  return new Proxy({} as ReturnType<typeof create>, {
    get(_target, property) {
      client ??= create();
      const value = Reflect.get(client, property);
      // $client is a callable SQL object, not a Drizzle method. Binding it
      // would discard unsafe/end/options and the rest of its public API.
      return typeof value === "function" && property !== "$client"
        ? value.bind(client)
        : value;
    },
  });
}
