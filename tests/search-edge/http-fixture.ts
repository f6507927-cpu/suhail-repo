import { createServer } from "node:http";
import { createSearchEdgeFixture, matchesSearch } from "./fixture";

// Local transport exercise only. Never use a client-controlled header as IP.
export async function startSearchEdgeFixture() {
  let time = 0;
  let upstreamRequests = 0;
  const edge = createSearchEdgeFixture(async request => {
    // Count only upstream search requests, not browser favicon/static loads.
    if (matchesSearch(request.url)) upstreamRequests++;
    return fetch(request, { redirect: "manual" });
  }, () => time);
  const server = createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined && name !== "host")
          headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
      const request = new Request(`http://127.0.0.1:3500${incoming.url}`, {
        method: incoming.method, headers,
      });
      const response = await edge.handle(request, incoming.socket.remoteAddress!);
      // fetch decodes compressed upstream bodies. Do not forward stale framing
      // or compression headers when writing those decoded bytes to the browser.
      const responseHeaders = new Headers(response.headers);
      for (const name of ["content-encoding", "content-length", "transfer-encoding"])
        responseHeaders.delete(name);
      outgoing.writeHead(response.status, Object.fromEntries(responseHeaders));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      outgoing.writeHead(502);
      outgoing.end("Local edge fixture failed");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3501, "127.0.0.1", resolve);
  });
  return {
    origin: "http://127.0.0.1:3501",
    upstreamRequests: () => upstreamRequests,
    advance: (milliseconds: number) => { time += milliseconds; },
    reset() { edge.reset(); time = 0; upstreamRequests = 0; },
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
