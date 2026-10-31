export type DatabaseCredential =
  | "DATABASE_URL_PUBLIC"
  | "DATABASE_URL_APP"
  | "DATABASE_URL_MIGRATIONS"
  | "DATABASE_URL_TEST";
export const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;

const usernames = {
  DATABASE_URL_PUBLIC: "suhail_public.",
  DATABASE_URL_APP: "suhail_app.",
  DATABASE_URL_MIGRATIONS: "postgres.",
} as const;

function refused(key: DatabaseCredential): never {
  throw new Error(
    `Database environment validation failed. Check variable name: ${key}. ` +
      "An explicit PostgreSQL username, host and port are required; " +
      "tests use loopback only, never Supabase; other connections require the matching Supabase pooler identity.",
  );
}

// Validate only this credential. Never consult generic DATABASE_URL or PG*.
export function databaseUrl(
  key: DatabaseCredential,
  value: unknown = process.env[key],
): string {
  parseConnection(key, value);
  return value as string;
}

function parseConnection(key: DatabaseCredential, value: unknown) {
  if (typeof value !== "string" || !value || value.trim() !== value)
    return refused(key);
  try {
    // WHATWG hostname normalization differs across Node releases. Refuse
    // encoded/whitespace host syntax before parsing rather than relying on
    // whether this version normalizes it to an approved hostname.
    const authority = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i)?.[1];
    const rawHostPort = authority?.slice(authority.lastIndexOf("@") + 1);
    if (!rawHostPort || /[%\\\s]/.test(rawHostPort)) return refused(key);
    const url = new URL(value);
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1)) || username;
    const host = url.hostname.toLowerCase();
    const port = Number(url.port);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !username ||
      !host ||
      !url.port ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      /[\s\0]/.test(username) ||
      database.includes("\0") ||
      password.includes("\0") ||
      url.hash
    )
      return refused(key);

    // Do not pass URI parameters through to postgres-js: they can set startup
    // options/roles. Only redundant, secure TLS declarations are accepted.
    for (const [name, parameter] of url.searchParams)
      if (name !== "sslmode" || !["require", "verify-full"].includes(parameter))
        return refused(key);

    const loopback = LOOPBACK_HOSTS.some((allowed) => allowed === host);
    if (key === "DATABASE_URL_TEST" || process.env.NODE_ENV === "test") {
      if (!loopback) return refused(key);
    } else if (
      !host.endsWith(".pooler.supabase.com") ||
      !/^[a-z0-9.-]+$/.test(host) ||
      !username.startsWith(usernames[key])
    )
      return refused(key);

    return {
      // postgres-js's string-host parser splits IPv6 on ':'. An array preserves
      // the validated address and prevents its multi-host URL interpretation.
      host: [host === "[::1]" ? "::1" : host],
      port: [port],
      username,
      database,
      // Empty strings are falsy in postgres-js and would inherit PGPASSWORD.
      // A password function is truthy even when it deliberately returns "".
      password: () => password,
    };
  } catch {
    return refused(key);
  }
}

export function databaseConnectionOptions(
  key: DatabaseCredential,
  value: unknown = process.env[key],
) {
  return parseConnection(key, value);
}
