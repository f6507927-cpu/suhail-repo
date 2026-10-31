# Next SSR and hydration regression fixture

`pnpm test:e2e:hydration` copies the current application into the ignored
`generated-artifacts/next-hydration` directory, builds it with Next, and runs its
standalone production server. It does **not** mount a UI into an empty document.

Only authentication and database IO modules are replaced in that copy. Synthetic
`hydration-session` cookies provide a user or admin profile; the real application's
guards, OAuth, consent and AAL2 enforcement are unchanged. Real private/public
root layouts, `proxy.ts`, nonce CSP, ISR, shared headers, locale navigation,
account/admin components and React hydration all run in the fixture. The account
acceptance is `2026-10-11T22:30:00Z`; the server is UTC and browser Los Angeles.
The test process strips workspace database/provider credentials before building
or serving. Tests never submit writes or contact a live provider.

Console/page listeners are attached before navigation and fail on every console
error, hydration warning and uncaught page error. Browser paint entries are
compared with the actual root theme mutation, not just its post-hydration class.
Next bootstrap scripts are delayed to expose a first-paint theme flash.

This suite establishes SSR/hydration behavior with synthetic sessions. It is not
live Google/TOTP verification. Existing real-app foundation and production suites
separately cover the public and anonymous auth documents.
