---
name: Next development origins
description: Avoiding blocked Next.js development HMR on cluster-qualified Replit domains.
---

Include the exact current Replit development domain in Next.js `allowedDevOrigins`, in addition to loopback origins used by local checks.

**Why:** Allowing `*.replit.dev` fixed the local capture but did not allow the actual preview host, which had another subdomain level for the Replit cluster. The server still blocked the user's HMR connection.

**How to apply:** Obtain the exact development domain from the platform's existing `REPLIT_DEV_DOMAIN` variable in configuration rather than hardcoding a particular workspace hostname. Verify the websocket upgrade using the preview origin, not only a localhost screenshot.
