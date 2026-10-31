---
name: WebKit browser verification
description: Engine-specific executable isolation and native dependency requirements for trustworthy phone checks.
---

Phone compatibility checks must run the actual browser engine, not just a mobile user agent. Keep Chromium and WebKit executable overrides separate, and use a WebKit build matching the installed Playwright version.

**Why:** A global Chromium override can accidentally launch the wrong executable for an iPhone project. Chromium touch emulation is not evidence of Safari compatibility.

**How to apply:** Assert and record the running browser engine in touch tests. Prefer the standard versioned Playwright installation on supported CI hosts. Report physical-device Safari checks separately from automated WebKit results.

Workspace Chromium checks can require the managed executable override even when
Chromium is already installed.

**Why:** The workspace can have a working managed Chromium but lack the exact
headless-shell revision requested by the current Playwright package. A missing
Playwright download is not evidence that the application is broken.

**How to apply:** Discover the installed executable with `command -v chromium`
and pass it to the existing Chromium-only test override for that invocation.
Do not change the WebKit executable or weaken application assertions, and do
not assume the workspace override should replace versioned browsers in CI.

A native browser's successful launch/version response is not proof that its
page-rendering runtime works.

**Why:** a bundled WebKit answered launch/version probes but hung creating a page
before any application navigation, making all UI cases time out.

**How to apply:** verify basic page creation before running a full native-browser
UI suite. Distinguish page-fixture/runtime failures from application failures and
use a supported, matching browser installation for the final engine verification.
