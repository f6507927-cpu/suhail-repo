import postgres from "postgres";
import { databaseTls } from "./tls";
import {
  databaseConnectionOptions,
  type DatabaseCredential,
} from "./connection-url";

type Settings = Pick<
  postgres.Options<Record<string, never>>,
  "ssl" | "prepare" | "max" | "idle_timeout" | "connect_timeout"
>;

export function connectDatabase(
  key: DatabaseCredential,
  settings: Settings,
  value?: string,
) {
  const options = databaseConnectionOptions(key, value);
  // postgres-js supports host/port arrays at runtime (and in ParsedOptions),
  // but its public Options type narrows them to scalars. Keep the assertion at
  // this driver boundary, retaining arrays to correctly support IPv6.
  return postgres({
    ...settings,
    ...options,
    ssl: databaseTls(key, options.host[0]),
  } as unknown as postgres.Options<Record<string, never>>);
}
