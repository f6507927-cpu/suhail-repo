# Security and stock review — local validation

## Final results

| Check | Result |
| --- | --- |
| Typecheck | Pass |
| ESLint | Pass |
| Logical CSS lint | Pass |
| Full unit suite | 1,156 passed; 0 failed; 72 files |
| Engine suite | 226 passed; 0 failed; 7 files |
| Engine coverage | 100% statements, branches, functions and lines |
| Full disposable PostgreSQL suite | 220 passed; 0 failed; 10 files |
| Database-credential-free production build | Pass |
| Production security browser suite | 7 passed; 0 failed |
| Stock browser suite | 19 passed; 0 failed |
| Accounts/methodology/navigation browser suite | 103 passed; 0 failed |
| Real Next hydration browser suite | 4 passed; 0 failed |
| Jobs build | Pass |

No tests are intentionally skipped in these final runs. Test suites run serially;
their own configured worker counts remain unchanged. The owned disposable
PostgreSQL 17 server binds only loopback, and `DATABASE_URL_TEST` is explicitly
unset for integration/stock commands to select the guarded disposable target.
Saved application/migrations credentials are never used by these tests.
The preview workflow is paused for production/browser validation and restored
afterwards. The disposable server is stopped after stock verification.

## Commands in execution order

Logs below are temporary local paths, not permanent project evidence.
All commands omit secret values. Initial read-only source discovery used
`git status --short`, `rg`, `ls`, `cat`/`sed`, and `git cat-file -t f679985`.
The supplied revision could not be resolved; no commit comparison is claimed.

1. `pnpm typecheck`
   - Initial failure: one test used `.url` on a function that returns a string.
     Corrected the test call; no connection policy changed.
2. Serial loop: `pnpm typecheck`, `pnpm lint`, `pnpm lint:logical`, `pnpm test`.
   - First three passed.
   - Initial unit result: 1,153 passed, 3 failed. Causes: generated Arabic caller
     line numbers were stale; a synthetic boolean criterion omitted its ratio;
     an old scalar canonicalization expectation assumed legacy rounding.
     Fixed finite/present failing-evidence handling and made scalar versus
     explicit-legacy expectations deliberate.
3. `pnpm ar-review:list`
   - 281 pending rows; 0 unresolved surfaces; 0 unused leaves.
     Regeneration changed caller locations only, not approved wording.
4. `pnpm test`
   - 1,156 passed. `/tmp/task80-test-final.log`.
5. `pnpm test:engine`
   - 226 passed; all coverage measures 100%. `/tmp/task80-engine.log`.
6. `env -u DATABASE_URL_TEST pnpm db:test:up`
   - Started fresh owned disposable PostgreSQL 17.
7. `env -u DATABASE_URL_TEST pnpm test:db`
   - Initial result: 219 passed, 1 failed. PostgreSQL displays 60 seconds as
     `1min` in SHOW. Corrected the assertion and additionally checked 60000ms
     from pg_settings. Optional local setting was reset in finally.
8. Stop the owned disposable server, then:
   `env -u DATABASE_URL_TEST pnpm db:test:up`
   - New fresh cluster, preserving empty-target bootstrap isolation.
9. `env -u DATABASE_URL_TEST pnpm test:db`
   - 220 passed. `/tmp/task80-db-final.log`.
10. `env -u DATABASE_URL_APP -u DATABASE_URL_PUBLIC -u DATABASE_URL_MIGRATIONS -u DATABASE_URL_TEST -u DATABASE_URL pnpm build`
    - Passed without database credentials. `/tmp/task80-build.log`.
11. `pnpm exec playwright test --config playwright.security.config.ts`
    - Initial result: 3 passed, 4 failed.
      Two browser tests could not launch the missing downloaded Chromium;
      the prefetch test exposed Next stripping Flight headers before proxy;
      the non-gating test incorrectly required a nonexistent favicon to be 200.
      Used installed Chromium, the documented Next header-preservation option,
      and a truthful 404 assertion for the absent favicon.
12. Same credential-free `pnpm build` command as step 10.
    - Passed. `/tmp/task80-build-final.log`.
13. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium pnpm exec playwright test --config playwright.security.config.ts`
    - 7 passed. `/tmp/task80-security-final.log`.
14. `env -u DATABASE_URL_TEST PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium pnpm exec playwright test --config playwright.stock.config.ts`
    - 19 passed. `/tmp/task80-stock-browser.log`.
15. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium pnpm exec playwright test --config playwright.accounts.config.ts`
    - 103 passed. `/tmp/task80-accounts-browser.log`.
16. `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium pnpm exec playwright test --config playwright.hydration.config.ts`
    - 4 passed. `/tmp/task80-hydration-browser.log`.
17. `pnpm typecheck && pnpm lint && pnpm lint:logical && pnpm build:jobs`
    - All passed after browser fixture changes.
18. Added explicit static-path error/no-immutable-cache regressions, then:
    `pnpm test`
    - 1,156 passed. `/tmp/task80-test-verified.log`.
19. Same credential-free `pnpm build` command as step 10.
    - Passed. `/tmp/task80-build-verified.log`.
20. Same installed-Chromium security command as step 13.
    - 7 passed, including real immutable chunk and missing-chunk 404.
      `/tmp/task80-security-verified.log`.
21. `git diff --check`
    - Passed. Final preview restart and screenshot verify public rendering;
      they are not signed-in/admin verification.

Non-failing tooling warnings: Vite warns about future native config loading
of CommonJS-named config files containing ESM; the existing production browser
harness warns that `next start` is not the recommended standalone launch command.
No package versions or production run commands were changed for those warnings.

## Browser and screenshot findings

- A real served production JS/CSS chunk returned public max-age/immutable with
  no CDN no-store contradiction, while preview documents retained no-store.
  A nonexistent static chunk returned 404 without immutable caching.
- Fifteen actual page views then a Sign in click returned final HTTP 200, with
  one stable local forwarded identity and no bucket reset/rotation.
- Forty marked requests did not spend auth/search capacity; unmarked requests
  exhausted the original capacity. API accounting and 429/no-store checks pass.
- English and Arabic stock cases passed at 390px and 1366px, including precise
  30.004 versus 30 failures, tiny boolean `> 0`, no fabricated missing definition,
  accessible cards/no hidden criteria column, and semantic separator-free
  analyst items. Light/dark accessibility checks report no serious/critical
  violations. Existing arbitrary narrative language fallbacks remain intentional.
- Full-page stock screenshots were captured under
  `generated-artifacts/stock-screenshots/` in both languages/themes, and the
  Arabic dark screenshot was inspected. Viewport-level DOM checks provide
  readable-value/layout assertions rather than relying on scaled long images.
- Arabic stock fixtures still show review markers (46 in the checked stock
  viewport versus 0 in English). This task does not approve or replace them;
  separate Arabic-interface work is in progress.
- Account/role/MFA/consent browser checks use explicit local boundary fixtures,
  not live privileged accounts. Hydration checks use a copied Next project with
  test-only IO substitution, never an auth bypass in the app.

## SQL and evidence limitations

- Registered but externally unapplied: `drizzle/0012_unmet_search_retention.sql`.
  Operator scheduling, daily invocation and verification are documented in
  `docs/SECURITY_STOCK_REVIEW.md`; no hosted cleanup or schedule is installed.
- Separate optional/unregistered:
  `scripts/db/optional/transaction-timeout.sql`.
  Local real PG17/fresh-login SHOW and pg_settings checks passed. The older
  branch was simulated on PG17; actual PG16/below-17 execution is unverified.
- No live Supabase reads/writes, migrations, server-version inspection, pooler
  changes, actual Replit forwarded-hop verification, Cloudflare activation,
  deployment or production MFA session was performed.
- Synthetic local forwarding proves classification/redaction and stable local
  budgeting, not the trustworthiness or shape of a hosted forwarded chain.
