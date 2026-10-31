import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createServer,
  connect,
  type Server,
  type ConnectionOptions,
} from "node:tls";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import { databaseTls } from "../src/db/tls";
import { connectDatabase } from "../src/db/connect";

let directory: string,
  ca: string,
  server: Server,
  untrustedServer: Server,
  port: number,
  untrustedPort: number;
const hostname = "db.fixture.pooler.supabase.com";
beforeAll(async () => {
  // Entirely local disposable TLS fixture, not an external service or stored key.
  directory = mkdtempSync(join(tmpdir(), "suhail-tls-"));
  const openssl = (...args: string[]) =>
    execFileSync("openssl", args, { cwd: directory, stdio: "ignore" });
  openssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.pem",
    "-days",
    "2",
    "-subj",
    "/CN=Disposable Test CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
  );
  openssl(
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "leaf.key",
    "-out",
    "leaf.csr",
    "-subj",
    `/CN=${hostname}`,
  );
  writeFileSync(
    join(directory, "extensions"),
    `basicConstraints=critical,CA:FALSE\nsubjectAltName=DNS:${hostname}\nextendedKeyUsage=serverAuth\n`,
  );
  openssl(
    "x509",
    "-req",
    "-in",
    "leaf.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    "leaf.pem",
    "-days",
    "2",
    "-extfile",
    "extensions",
  );
  ca = readFileSync(join(directory, "ca.pem"), "utf8");
  server = createServer(
    {
      key: readFileSync(join(directory, "leaf.key")),
      cert: readFileSync(join(directory, "leaf.pem")),
    },
    (socket) => socket.end(),
  );
  server.on("tlsClientError", () => {});
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
  openssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "untrusted.key",
    "-out",
    "untrusted.pem",
    "-days",
    "2",
    "-subj",
    `/CN=${hostname}`,
    "-addext",
    `subjectAltName=DNS:${hostname}`,
  );
  untrustedServer = createServer(
    {
      key: readFileSync(join(directory, "untrusted.key")),
      cert: readFileSync(join(directory, "untrusted.pem")),
    },
    (socket) => socket.end(),
  );
  untrustedServer.on("tlsClientError", () => {});
  await new Promise<void>((resolve) =>
    untrustedServer.listen(0, "127.0.0.1", resolve),
  );
  untrustedPort = (untrustedServer.address() as { port: number }).port;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => untrustedServer.close(() => resolve()));
  rmSync(directory, { recursive: true, force: true });
});
function handshake(options: ConnectionOptions | false, targetPort = port) {
  if (!options) throw new Error("expected verified TLS");
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port: targetPort, ...options });
    socket.on("secureConnect", () => {
      socket.destroy();
      resolve();
    });
    socket.on("error", reject);
  });
}
describe("D-94 verified database TLS", () => {
  it.each([
    undefined,
    "",
    "not a certificate",
    "-----BEGIN CERTIFICATE-----\nbad\n-----END CERTIFICATE-----",
  ])("refuses missing/invalid CA", (value) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_DB_CA_CERT", value);
    expect(() => databaseTls("DATABASE_URL_MIGRATIONS", hostname)).toThrow(
      "SUPABASE_DB_CA_CERT",
    );
  });
  it("only disposable loopback test connections are exempt", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", undefined);
    expect(databaseTls("DATABASE_URL_TEST", "127.0.0.1")).toBe(false);
    expect(databaseTls("DATABASE_URL_APP", "localhost")).toBe(false);
    expect(() => databaseTls("DATABASE_URL_TEST", hostname)).toThrow();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => databaseTls("DATABASE_URL_APP", "localhost")).toThrow();
    expect(() =>
      connectDatabase(
        "DATABASE_URL_TEST",
        { ssl: false },
        "postgresql://postgres@outside.test:5432/test",
      ),
    ).toThrow("loopback");
  });
  it.each(["expired", "not yet valid"])("refuses a %s CA", (state) => {
    const certificate = new X509Certificate(ca);
    vi.stubEnv("SUPABASE_DB_CA_CERT", ca);
    vi.useFakeTimers();
    vi.setSystemTime(
      state === "expired"
        ? Date.parse(certificate.validTo) + 1
        : Date.parse(certificate.validFrom) - 1,
    );
    expect(() => databaseTls("DATABASE_URL_MIGRATIONS", hostname)).toThrow(
      "SUPABASE_DB_CA_CERT",
    );
  });
  it("refuses a leaf certificate as the CA trust anchor", () => {
    vi.stubEnv(
      "SUPABASE_DB_CA_CERT",
      readFileSync(join(directory, "leaf.pem"), "utf8"),
    );
    expect(() => databaseTls("DATABASE_URL_MIGRATIONS", hostname)).toThrow(
      "SUPABASE_DB_CA_CERT",
    );
  });
  it("valid trust chain and hostname succeed locally; SSL settings cannot weaken trust", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_DB_CA_CERT", ca);
    const settings = databaseTls("DATABASE_URL_MIGRATIONS", hostname);
    expect(settings).toMatchObject({
      rejectUnauthorized: true,
      servername: hostname,
    });
    await expect(handshake(settings)).resolves.toBeUndefined();
    const sql = connectDatabase(
      "DATABASE_URL_MIGRATIONS",
      { ssl: false },
      `postgresql://postgres.test@${hostname}:5432/test`,
    );
    expect(sql.options.ssl).toMatchObject({
      rejectUnauthorized: true,
      ca,
      servername: hostname,
    });
    await sql.end({ timeout: 0 }); // never executes a database connection
  });
  it("a trusted certificate with the wrong hostname is refused", async () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", ca);
    await expect(
      handshake(
        databaseTls(
          "DATABASE_URL_MIGRATIONS",
          "wrong.fixture.pooler.supabase.com",
        ),
      ),
    ).rejects.toMatchObject({ code: "ERR_TLS_CERT_ALTNAME_INVALID" });
  });
  it("untrusted server certificates are refused even with the correct hostname", async () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", ca);
    const options = databaseTls("DATABASE_URL_MIGRATIONS", hostname);
    if (!options) throw new Error("expected TLS");
    await expect(handshake(options, untrustedPort)).rejects.toThrow();
  });
});
