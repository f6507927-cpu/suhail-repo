import { pathToFileURL } from "node:url";

const usage = "Usage: pnpm smoke -- --base <http(s) origin>";
export function parseArguments(args) {
  const values = args[0] === "--" ? args.slice(1) : args;
  if (values.length !== 2 || values[0] !== "--base") throw new Error(usage);
  let base;
  try { base = new URL(values[1]); } catch { throw new Error(usage); }
  if (!["http:", "https:"].includes(base.protocol) ||
      (base.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) ||
      base.username || base.password || base.search || base.hash || base.pathname !== "/")
    throw new Error(usage);
  return base.origin;
}

export function robotsDisallowsAll(text) {
  // Evaluate groups, not unrelated lines from different user agents.
  const groups = [];
  let group = { agents: [], rules: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim().toLowerCase(), value = match[2].trim();
    if (key === "user-agent") {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") group.rules.push([key, value]);
  }
  groups.push(group);
  const wildcard = groups.filter(g => g.agents.includes("*"));
  return wildcard.length > 0 && wildcard.every(g =>
    g.rules.some(([key, value]) => key === "disallow" && value === "/") &&
    !g.rules.some(([key, value]) => key === "allow" && value !== ""));
}

function protections(headers) {
  const robots = (headers.get("x-robots-tag") ?? "").toLowerCase().split(/[,\s]+/);
  const csp = headers.get("content-security-policy") ?? "";
  return robots.includes("noindex") && robots.includes("nofollow") &&
    !headers.has("www-authenticate") &&
    headers.get("x-content-type-options") === "nosniff" &&
    headers.get("x-frame-options") === "DENY" &&
    headers.get("referrer-policy") === "strict-origin-when-cross-origin" &&
    headers.get("cross-origin-opener-policy") === "same-origin" &&
    /max-age=[1-9]\d*/.test(headers.get("strict-transport-security") ?? "") &&
    ["camera=()", "microphone=()", "geolocation=()"].every(v => (headers.get("permissions-policy") ?? "").includes(v)) &&
    ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'"].every(v => csp.includes(v)) &&
    /(?:^|;)\s*script-src\s/.test(csp) &&
    ["cache-control", "cdn-cache-control", "cloudflare-cdn-cache-control"].every(name => /\bno-store\b/i.test(headers.get(name) ?? ""));
}

async function boundedText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) throw new Error("body limit");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel(); }
}

/** Four sequential read-only GETs; no environment, cookies, OAuth, SQL or retries. */
export async function smoke(base, { timeoutMs = 5000, log = console.log } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error("Invalid timeout");
  let passed = true;
  for (const path of ["/", "/en", "/api/health", "/robots.txt"]) {
    let response;
    try {
      response = await fetch(new URL(path, base), {
        method: "GET", redirect: "manual", credentials: "omit",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 200) throw new Error("status");
      if (!protections(response.headers)) throw new Error("protections");
      if (path === "/robots.txt" && !robotsDisallowsAll(await boundedText(response))) throw new Error("robots");
      log(`PASS ${path}`);
    } catch {
      // Never echo the target origin, redirect location, body or underlying errors.
      passed = false;
      log(`FAIL ${path}: expected 200 with preview protections; check status, headers, robots policy or network timeout.`);
    } finally {
      try { await response?.body?.cancel(); } catch { /* Already consumed/aborted. */ }
    }
  }
  return passed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const base = parseArguments(process.argv.slice(2));
    if (!await smoke(base)) process.exitCode = 1;
  } catch {
    console.error(usage);
    process.exitCode = 1;
  }
}
