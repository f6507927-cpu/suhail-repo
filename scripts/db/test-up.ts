import { execFile, spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { LOCAL_TEST_DATABASE_URL } from "./test-target";

const exec = promisify(execFile);
export const TEST_PORT = 55432;
const host = "127.0.0.1";

export function postgresExecutable(name: string): string {
  return process.env.POSTGRES_TEST_BIN
    ? join(process.env.POSTGRES_TEST_BIN, name)
    : name;
}

export function assertPostgres17(version: string): void {
  if (!/\(PostgreSQL\) 17(?:\.|\s|$)/.test(version))
    throw new Error(
      "db:test:up requires native PostgreSQL 17 binaries. " +
        "Use the committed Replit postgresql_17 package or set POSTGRES_TEST_BIN to a PostgreSQL 17 bin directory.",
    );
}

export async function assertTestPortFree(port = TEST_PORT): Promise<void> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          `127.0.0.1:${port} is unavailable. Stop the previous db:test:up first; refusing to touch any existing database.`,
        ),
      ),
    );
    probe.listen(port, host, () => probe.close(() => resolve()));
  });
}

// D-78: a fresh, private local process, not Replit Database or a Supabase target.
export async function startLocalTestDatabase(): Promise<void> {
  for (const binary of ["postgres", "initdb", "createdb"]) {
    const { stdout } = await exec(postgresExecutable(binary), ["--version"]);
    assertPostgres17(stdout);
  }
  await assertTestPortFree();
  const cache = resolve(".cache");
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, "postgres-test-"));
  const data = join(directory, "data");
  const logPath = join(directory, "postgres.log");
  let server: ChildProcess | undefined;
  let exited: Promise<void> | undefined;
  let hasExited = false;
  let stopping = false;
  const stop = () => {
    stopping = true;
    server?.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const log = await open(logPath, "a");
  try {
    await exec(postgresExecutable("initdb"), [
      "-D",
      data,
      "--username=postgres",
      "--auth-local=trust",
      "--auth-host=trust",
      "--encoding=UTF8",
      "--no-locale",
    ]);
    if (stopping) return;
    server = spawn(
      postgresExecutable("postgres"),
      [
        "-D",
        data,
        "-h",
        host,
        "-p",
        String(TEST_PORT),
        "-c",
        "unix_socket_directories=",
        "-c",
        "max_connections=10",
        "-c",
        "shared_buffers=16MB",
      ],
      { stdio: ["ignore", log.fd, log.fd] },
    );
    let launchError: Error | undefined;
    exited = new Promise<void>((resolve) => {
      server!.once("exit", () => {
        hasExited = true;
        resolve();
      });
      server!.once("error", (error) => {
        launchError = error;
        hasExited = true;
        resolve();
      });
    });
    const deadline = Date.now() + 30_000;
    while (true) {
      if (stopping) return;
      if (hasExited || Date.now() > deadline)
        throw new Error(
          `Local PostgreSQL startup failed: ${launchError?.message ?? (await readFile(logPath, "utf8"))}`,
        );
      // Read our own server's log, rather than accepting another process's port.
      if (
        (await readFile(logPath, "utf8")).includes(
          "database system is ready to accept connections",
        )
      )
        break;
      await delay(100);
    }
    await exec(postgresExecutable("createdb"), [
      "-h",
      host,
      "-p",
      String(TEST_PORT),
      "-U",
      "postgres",
      "--no-password",
      "suhail_test",
    ]);
    if (stopping) return;
    console.log(`Disposable PostgreSQL 17 ready: ${LOCAL_TEST_DATABASE_URL}`);
    console.log(
      "Run env -u DATABASE_URL_TEST pnpm test:db in another terminal. " +
        "Stop with Ctrl-C, then restart for a fresh suite run.",
    );
    await exited;
    if (!stopping)
      throw new Error(
        `Local PostgreSQL stopped unexpectedly: ${await readFile(logPath, "utf8")}`,
      );
  } finally {
    if (server && exited) {
      server.kill("SIGTERM");
      const forceStop = setTimeout(() => server?.kill("SIGKILL"), 10_000);
      forceStop.unref();
      await exited;
      clearTimeout(forceStop);
    }
    await log.close();
    // Remove only this invocation's mkdtemp directory, never any existing cluster.
    await rm(directory, { recursive: true, force: true });
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await startLocalTestDatabase();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Local PostgreSQL startup failed.",
    );
    process.exitCode = 1;
  }
}
