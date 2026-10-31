# Foundation browser runner verification

## Diagnosis

The initial self-managed loopback run reproduced the reported behavior: five of
six tests failed with repeated document navigations and disabled theme controls,
even with one worker. The home/keyboard test originally passed because it checked
server-rendered markup rather than hydration.

The same application subsequently hydrated successfully after stopping that
server and starting another development session, without editing application
components, CSP, auth or localization. Browser diagnostics then showed an HMR
connection, no page errors, and one actual document load. Soft HMR history events
were not counted as document requests.

Both loopback and the Replit preview origin worked with the running preview.
Switching back to a self-managed loopback server also worked. This rules out a
consistent loopback-origin rejection and a deterministic theme hydration defect.
The observed failure was session/generated-state dependent. The exact original
stale compiler artifact was not captured before the restart and cannot be
identified retrospectively; cache corruption is not claimed as a proven specific
upstream bug.

## Runner change

- The self-managed runner refuses to reuse an unknown existing server.
- Only that server disables Turbopack's persisted development compiler cache.
  This prevents inheritance of previous session compiler state; it does not
  disable HMR or alter application behavior.
- An explicit `PLAYWRIGHT_BASE_URL` uses the already-running preview, with no
  managed web server. This compares the same tests rather than a separate,
  weaker preview script.
- The foundation suite attaches origin, document requests, browser errors,
  failed requests and selected HMR metadata. Failures retain traces.
- Styleguide and home checks require enabled theme controls and assert that
  the document has not reloaded after the development handshake settles.
- The preview workflow is stopped for self-managed runs, then restored before
  preview checks. Builds and production servers must remain serialized with
  development runs because Next metadata is shared.

No security policy, authentication guard, secret, external service, dependency,
or database migration changed. Preview and production compiler caching retain
their existing defaults.

## Verification

With the workspace's managed Chromium executable:

| Check | Result |
| --- | --- |
| Six foundation tests, self-managed `127.0.0.1:3100`, default four workers | 6 passed |
| Identical six tests, proxied Replit preview, default four workers | 6 passed |
| TypeScript check | passed |
| ESLint | passed |
| Logical-direction lint | passed |
| Unit tests, including three runner-isolation regressions | 529 passed |
| Running preview screenshot at `/styleguide` | rendered; HMR connected |

The preview workflow was restored on port 5000. The signed-in forms and complete
Google OAuth flow are separate tasks and were not exercised here.

See the README for commands and the requirement to stop the preview workflow
before self-managed browser checks.
