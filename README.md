# Suhail

## Run

```sh
pnpm install
pnpm dev
```

## Test

```sh
pnpm typecheck
pnpm lint
pnpm lint:logical
pnpm test
pnpm test:e2e
```

### Foundation browser checks

Stop the preview workflow before running the self-managed loopback checks.
Do not run a Next build, production server, or another dev server concurrently:
Next's generated state and development lock belong to the repository, not a port.
The runner owns port 3100, refuses to reuse another server, and disables
Turbopack's persisted dev compiler cache only for its own server.

```sh
pnpm exec playwright test e2e/foundation.spec.ts
```

Restart the preview workflow afterward. To compare the **same six tests** against
the running Replit preview (without starting another server):

```sh
PLAYWRIGHT_BASE_URL="https://$REPLIT_DEV_DOMAIN" pnpm exec playwright test e2e/foundation.spec.ts
```

If the workspace uses managed Chromium, prefix either command with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE="$(command -v chromium)"`. No browser install is
needed in that case; CI keeps its versioned Playwright browser.
Failures retain a Playwright trace; all foundation tests attach their origin,
document requests, browser errors and HMR connection metadata. Styleguide checks
also assert hydration and a single document load after the HMR handshake.
Preview and production compiler caching, CSP and authentication are unchanged.

### Production iPhone/WebKit checks

Use a Playwright-supported host (CI uses Ubuntu) with the matching browsers and
native dependencies. Chromium's touch emulation is not a Safari check.

```sh
pnpm exec playwright install --with-deps chromium webkit
# Stop the preview and finish any self-managed Next dev suites first.
pnpm build
pnpm exec playwright test --config playwright.production.config.ts
```

The production runner owns port 3200 and refuses an existing server. It runs
Arabic RTL and English LTR touch checks in Chromium and actual WebKit with an
iPhone device profile at 320px and 390px. WebKit also checks private-route
authentication boundaries and nonce CSP without signing in. Traces are retained
on failure under `generated-artifacts/playwright-production`; touch tests attach
the actual browser engine/version. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` applies only
to Chromium, never WebKit. An environment-managed **matching Playwright WebKit**
can use `PLAYWRIGHT_WEBKIT_EXECUTABLE`; it still needs the supported host's native
libraries and graphics drivers. CI uses the standard versioned downloads.
Builds, production servers and Next development
servers must run sequentially; restart the preview after the production suite.
This covers Playwright WebKit, not a physical iPhone's Safari browser chrome.

## Build

```sh
pnpm build
pnpm start
```
