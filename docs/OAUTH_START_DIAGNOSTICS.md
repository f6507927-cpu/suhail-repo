# Google sign-in: bounded production diagnostics

The published `/auth/start` endpoint was confirmed to return HTTP 500 with
`{"error":"operation_failed"}`. Existing code deliberately hid unexpected
exceptions, but did not log enough information to identify the failure.
Production investigation could not establish its underlying cause.

This patch adds diagnostics only. It does not fix or claim to fix that
unidentified production failure, change sign-in responses, relax origin/URL
validation, change Supabase configuration, or change production startup.

## After the founder republishes

The first publish attempt was blocked by two critical Next.js 16.4.0 findings:
`GHSA-2464-fhr4-w9xw` and `GHSA-673q-mjm6-r5xr`. The publishing logs identify
16.4.1 as the patched version. Next.js, its ESLint configuration and the lockfile
have been updated accordingly; the security gate has not been bypassed.
Until a publish succeeds, the live version will not contain these diagnostics.

1. Reproduce the failure once using the Google button.
2. Open the published application's runtime logs and filter for
   `oauth_start_failed`.
3. Share only the structured event, not request headers, cookies, connection
   strings, provider payloads or tokens.

For example, a network failure could produce:

```json
{"event":"oauth_start_failed","category":"auth","status":500,"stage":"provider_check","reason":"fetch_failed","failure_code":"ENOTFOUND"}
```

This is an illustrative fixture, not a finding from production.

Stages identify origin validation, form parsing, callback construction, provider
availability, session-client construction, the OAuth request, destination URL
validation, and the consent-cookie write. Reasons are fixed categories:
`auth_rejected`, `auth_environment`, `invalid_destination`, `invalid_url`,
`timeout`, `fetch_failed`, or `unexpected`. An optional `failure_code` is limited
to an explicit transport/TLS-code allowlist in the structured logger.

Only HTTP 5xx failures are logged; ordinary 403 origin rejections and successful
starts produce no diagnostic event. Logging is server-only. Messages, stacks,
provider responses, environment values/names from exceptions, URLs, form data,
headers, cookies, user identifiers and tokens are never passed to the logger.
Unrecognized values are omitted rather than serialized.

No flag or new secret is required. The event is always enabled for failed
starts once this patch is published. Removing the route's diagnostic call in a
later reviewed patch removes these events; do not change the private error
responses or fail-closed guards when doing so.

## Separate observation

Production logs also warned that `next start` is not the recommended launcher
for standalone output. That is not evidence of the OAuth error's cause.
The current patch intentionally leaves deployment commands unchanged.

## Validation notes

Typecheck, ESLint and logical-direction lint passed. Tests cover successful
starts with no log output, unchanged private failure responses, correct stages,
expected origin rejections with no log output, and rejection of arbitrary
messages/extra fields/transport codes. The D-95 reviewed lifecycle fingerprint
was updated after confirming that origin checks, provider/destination guards,
PKCE options and consent-cookie protections are unchanged.

An intermediate full unit run exposed an unrelated existing timing-sensitive
performance fixture: it generates the expected and observed synthetic JWT at
different calls to `Date.now()`, and they can straddle a second boundary.
The focused rerun passed all 92 auth/security/performance tests without changing
that fixture or weakening its exact-token assertion. This is not evidence of
a production authentication failure.

The final full unit run passed all 1,285 tests across 78 files.
`pnpm build` also passed with all database URL variables explicitly unset.
No hosted migration, setting change or publication was performed.

After the publishing security fix, the full unit suite still passed (1,285),
as did typecheck, both lint checks and the database-free Next.js 16.4.1 build.
`pnpm audit --prod --json` reported no vulnerabilities. The all-dependency audit
reported zero critical findings, with one high (`braces`, ESLint tooling) and
one moderate (older transitive `esbuild`, Drizzle tooling) finding remaining.

The production security browser run passed 8 of 9 tests. Its legal-draft test
still expects a literal review marker inside the public article, although D-140
intentionally strips those markers while retaining the visible draft banner.
That expectation is present in committed tests and the marker-stripping behavior
is present in committed LegalDocument code; neither was changed by this patch.
Legal wording and the test were left untouched.
