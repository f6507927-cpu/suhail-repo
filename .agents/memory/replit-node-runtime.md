---
name: Replit Node runtime
description: Why selecting the Node 22 Replit module alone may not pin pnpm-run scripts.
---

Keep the pnpm project runtime on Node 22 and verify it independently of the shell's Node runtime.

**Why:** In this environment, selecting the Node 22 module made `node --version` report Node 22, while the pnpm executable still used a bundled Node 24 and reported an engine mismatch. Pinning pnpm's project runtime resolved the mismatch.

**How to apply:** When changing the Node module or package-manager configuration, check both `node --version` and `pnpm exec node --version`. Do not assume that matching the Replit module and package engines is sufficient for scripts.

Identical Node version numbers do not guarantee identical public-network trust
stores. The pnpm-selected binary rejected the public SEC certificate chain with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while the shell's native Node of the same
version successfully fetched through the existing SEC client.

**Why:** Pinning a runtime fixes version drift, not the binary's certificate
configuration. A generic sanitized request failure can conceal this distinction.

**How to apply:** For public-only evidence capture, compare the existing client
under native `node --conditions=react-server --import tsx` before attributing a
pnpm transport failure to SEC availability. Never disable TLS verification, echo
identifying request headers, or change database connection settings to work
around a public-fetch problem.

The selected Node's `--use-system-ca` flag is not sufficient when its compiled
CA search paths cannot discover Replit's existing certificate bundle.

**Why:** A read-only Supabase provider-settings check succeeded under native Node
but failed under pnpm-selected Node with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
The system-CA flag still failed; explicitly adding the existing
`/etc/ssl/certs/ca-certificates.crt` bundle through `NODE_EXTRA_CA_CERTS` succeeded
without disabling TLS verification. This was verified in the workspace, not the
published container.

**How to apply:** Check bundle readability and compare the same public request
under both runtimes before blaming provider configuration. Explicit additional
trusted CAs can resolve this mismatch; production configuration needs approval,
republishing and target-side verification. Never use insecure TLS bypasses.
