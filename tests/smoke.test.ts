import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { smoke, parseArguments, robotsDisallowsAll } from "../scripts/smoke.mjs";
import { secureResponse } from "../src/security/headers";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
async function fixture(handler?: (req: IncomingMessage, res: ServerResponse) => void) {
  const requests: IncomingMessage[] = [];
  const server = createServer((req, res) => {
    requests.push(req);
    const headers = secureResponse(new Response(), true).headers;
    headers.forEach((value, name) => res.setHeader(name, value));
    if (handler) handler(req, res);
    else res.end(req.url === "/robots.txt" ? "User-agent: *\nDisallow: /\n" : "fixture");
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local fixture port");
  return { base: `http://127.0.0.1:${address.port}`, requests };
}
async function cli(args: string[]) {
  return new Promise<{ code: number | null; output: string }>(resolve => {
    // Allowlist environment: no inherited database, provider or preview credentials.
    const child = spawn(process.execPath, ["scripts/smoke.mjs", ...args], {
      env: { PATH: process.env.PATH, NODE_ENV: "test" }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", value => { output += value; });
    child.stderr.on("data", value => { output += value; });
    child.on("close", code => resolve({ code, output }));
  });
}
describe("preview HTTP-only smoke", () => {
  it("accepts direct and pnpm-forwarded arguments", () => {
    expect(parseArguments(["--base", "https://fixture.test"])).toBe("https://fixture.test");
    expect(parseArguments(["--", "--base", "http://127.0.0.1:5000/"])).toBe("http://127.0.0.1:5000");
  });
  it.each([
    [], ["--"], ["--base"], ["--base", "bad"], ["--base", "https://fixture.test", "--extra"],
    ["--base", "https://user:private@fixture.test"], ["--base", "https://fixture.test/path"],
    ["--base", "https://fixture.test?secret=private"], ["--base", "https://fixture.test#fragment"],
    ["--base", "ftp://fixture.test"], ["--base", "http://remote.test"], ["--base", "data:text/plain,test"],
  ].map(args => ({ args })))("rejects invalid args without echoing values: $args", ({ args }) => {
    expect(() => parseArguments(args)).toThrow("Usage:");
  });
  it("checks four routes anonymously and exits successfully through the real CLI", async () => {
    const { base, requests } = await fixture();
    const result = await cli(["--", "--base", base]);
    expect(result.code).toBe(0);
    expect(result.output.match(/PASS/g)).toHaveLength(4);
    expect(requests.map(req => req.url)).toEqual(["/", "/en", "/api/health", "/robots.txt"]);
    for (const req of requests) {
      expect(req.method).toBe("GET");
      expect(req.headers.authorization).toBeUndefined();
      expect(req.headers.cookie).toBeUndefined();
    }
  });
  it("the pnpm command forwards -- --base correctly", async () => {
    const { base } = await fixture();
    const child = spawn("pnpm", ["smoke", "--", "--base", base], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" }, stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", value => { output += value; });
    child.stderr.on("data", value => { output += value; });
    const code = await new Promise(resolve => child.on("close", resolve));
    expect(code, output).toBe(0);
    expect(output.match(/PASS/g)).toHaveLength(4);
  }, 15000);
  it.each(["x-robots-tag", "content-security-policy", "x-frame-options", "cache-control",
    "strict-transport-security", "cdn-cache-control", "cloudflare-cdn-cache-control"])(
    "fails nonzero on missing %s without response body/target leaks", async name => {
      const { base } = await fixture((_req, res) => {
        res.removeHeader(name);
        res.end("private-body-secret");
      });
      const result = await cli(["--base", base]);
      expect(result.code).toBe(1);
      expect(result.output).toContain("FAIL /api/health");
      expect(result.output).not.toContain(base);
      expect(result.output).not.toContain("private-body-secret");
    },
  );
  it.each(["noindex", "nofollow", "all"])("rejects incomplete robots header %s", async value => {
    const { base } = await fixture((_req, res) => { res.setHeader("X-Robots-Tag", value); res.end(); });
    expect(await smoke(base, { log: () => {} })).toBe(false);
  });
  it.each([301, 307, 401, 404, 500])("rejects status %s without following redirects", async status => {
    const { base, requests } = await fixture((_req, res) => {
      res.statusCode = status;
      res.setHeader("Location", "https://private-target.test/secret");
      res.setHeader("WWW-Authenticate", 'Basic realm="private"');
      res.end("private");
    });
    const result = await cli(["--base", base]);
    expect(result.code).toBe(1);
    expect(result.output).not.toMatch(/private|Basic/);
    expect(requests).toHaveLength(4);
  });
  it("bounds network and streamed-body waits", async () => {
    const { base } = await fixture((req, res) => {
      if (req.url === "/robots.txt") { res.writeHead(200); res.write("User-agent: *\n"); }
      // Deliberately never finish responses.
    });
    const lines: string[] = [];
    expect(await smoke(base, { timeoutMs: 30, log: line => lines.push(line) })).toBe(false);
    expect(lines).toHaveLength(4);
    expect(lines.every(line => line.startsWith("FAIL"))).toBe(true);
  });
  it("bounds robots body size", async () => {
    const { base } = await fixture((req, res) => res.end(req.url === "/robots.txt" ? "x".repeat(65537) : ""));
    expect(await smoke(base, { log: () => {} })).toBe(false);
  });
  it("sanitizes invalid CLI arguments and refused connections", async () => {
    const invalid = await cli(["--base", "https://name:secret@fixture.test"]);
    expect(invalid.code).toBe(1);
    expect(invalid.output).not.toMatch(/secret|fixture/);
    const { base } = await fixture();
    const server = servers.pop()!;
    await new Promise<void>(resolve => server.close(() => resolve()));
    const result = await cli(["--base", base]);
    expect(result.code).toBe(1);
    expect(result.output).not.toContain(base);
  });
  it("requires disallow-all in the wildcard group, never a different group", () => {
    expect(robotsDisallowsAll("# test\nUser-agent: *\nDisallow: /\n")).toBe(true);
    expect(robotsDisallowsAll("User-agent: *\nDisallow: \nUser-agent: bot\nDisallow: /")).toBe(false);
    expect(robotsDisallowsAll("User-agent: bot\nDisallow: /")).toBe(false);
    expect(robotsDisallowsAll("User-agent: *\nDisallow: /\nAllow: /")).toBe(false);
    expect(robotsDisallowsAll("User-agent: *\nDisallow: /account")).toBe(false);
  });
});
