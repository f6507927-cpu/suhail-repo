---
name: Browser test executables
description: Missing Playwright cache does not establish that Chromium is unavailable.
---

Before downloading or installing a browser for local tests, check for an existing
Nix-provided Playwright Chromium and use the test configuration's executable override.

**Why:** The default Playwright cache was absent even though a matching Chromium
was already available in the Replit Nix environment. Installing another browser
would have added unnecessary setup and storage.

**How to apply:** For local browser verification only, locate the installed
executable and pass its path through the existing test-runner override. Do not
commit a machine-specific Nix-store path or change hosted settings.
