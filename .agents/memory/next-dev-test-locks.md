---
name: Next dev test locks
description: Why the preview workflow and Playwright's self-managed server cannot run concurrently.
---

Pause the preview workflow before running Playwright with its self-managed Next.js development server, then restore the workflow afterward.

**Why:** Next.js 16's development-server lock is scoped to the project directory, not to the port. A preview server and a Playwright server in the same repository conflict even when they use different ports.

**How to apply:** When running the existing end-to-end configuration, stop the main workflow, execute the smoke tests, and restart the workflow afterward. Do not interpret the development lock error as an application failure or change product code to work around it.

Also serialize production builds/servers and development-browser runs in this repository.

**Why:** Although development output lives under `.next/dev`, shared Next metadata can be contaminated by concurrent production work. Observed failures include JSON parse errors, persistent HMR reloads and missing private response headers.

**How to apply:** Finish production builds and production browser checks before starting Playwright's dev server. Unit tests and lints can run independently; production and dev Next processes are not independent here.
