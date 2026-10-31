import assert from "node:assert/strict";
import { NextRequest } from "next/server";
// Next's installed RSC renderer supplies the actual React request-cache context.
// @ts-expect-error Next's private renderer does not publish declarations.
import { renderToReadableStream } from "next/dist/compiled/react-server-dom-webpack/server.edge";
import proxy from "../../src/proxy";
import Layout from "../../src/app/[locale]/(private)/admin/(protected)/layout";
import Page from "../../src/app/[locale]/(private)/admin/(protected)/[section]/page";
import { requests, scenario, cookies } from "./state";
import { assertions } from "./assertions";
import { installTransport } from "./transport";

installTransport();

async function documentRequest() {
  const s = scenario();
  return requests.run(s, async () => {
    const started = performance.now();
    const request = new NextRequest("https://fixture.test/admin/methodologies", {
      headers: { cookie: cookies().map(c => `${c.name}=${c.value}`).join("; ") },
    });
    const response = await proxy(request);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    const errors: unknown[] = [];
    const stream = renderToReadableStream(
      <Layout params={Promise.resolve({ locale: "en" })}>
        <Page params={Promise.resolve({ locale: "en", section: "methodologies" })} searchParams={Promise.resolve({})} />
      </Layout>, {}, { onError: (error: unknown) => { errors.push(error); } });
    const reader = stream.getReader();
    let first = 0;
    let body = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      first ||= performance.now() - started;
      body += new TextDecoder().decode(chunk.value);
    }
    assert.deepEqual(errors, []);
    assert.ok(body.includes("methodology-fixture"), "Successful methodology render required");
    assert.equal(s.queries.length, 5);
    return { ttfb: first, total: performance.now() - started,
      authCalls: s.calls.length, roleLookups: s.lookups, maxQueries: s.maxActive };
  });
}

async function main() {
  const samples = [];
  for (let index = 0; index < 11; index++) samples.push(await documentRequest());
  if (!process.argv.includes("--baseline")) {
    for (const sample of samples) {
      assert.ok(sample.authCalls <= 2, "Proxy plus rendering must use at most two Auth HTTP calls");
      assert.equal(sample.roleLookups, 1);
      assert.equal(sample.maxQueries, 5);
    }
  }
  console.log(JSON.stringify({ mode: "isolated-rsc-fixture", providerLatencyMs: 15,
    databaseQueryLatencyMs: 15, cold: samples[0], warm: samples.slice(1) }, null, 2));
  if (process.argv.includes("--test")) await assertions();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
