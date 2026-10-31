# Pre–Step Six security handoff

This handoff covers hardening only. It does not start Step 6, supply a production
methodology, approve legal text, configure a provider, or authorize an external
database migration. Decisions D-92–D-95 supplement the existing founder decisions.

## Finding-to-change and test map

| Finding | Change | Verification |
| --- | --- | --- |
| H1 | Empty criteria throw typed `EngineInputError`; no screening result is produced. | `src/engine/hardening.test.ts` |
| H2 | Shares are `[0,1]` fractions; complete totals and revenue/share contradictions use the approved six-decimal envelope. Missing/unknown evidence is not invented. SQL also constrains non-null shares. | Engine hardening tests; insert/update cases in `tests/database.integration.test.ts` |
| L4/L5 | Unsupported new-screening versions, negative margins and non-finite intermediate sums/ratios fail explicitly. Historical payload verification, nonpositive denominator unknowns and unregistered evaluator fallback remain. | Engine hardening/completeness/property tests and full coverage run |
| M1 | Encoded private roots/locales and dotted descendants receive nonce CSP, noindex and private no-store. Malformed escapes return 400. Public requests ignore spoofed private/nonce/CSP headers and remain cookie-free. | `tests/proxy-auth.test.ts`; actual production HTTP requests in `e2e/production.spec.ts` |
| M2 | AST discovery includes every root/group/nested/JavaScript route handler and nested inline server action. Guard-first enforcement has only documented, exact full-source-pinned bootstrap exceptions. | `tests/authorization-guard.test.ts`; policy reasons in `scripts/authorization-policies.ts` |
| M3 | SQL permanently blocks demo/internal provenance, requires an approved populated immutable version, verified non-demo source metadata and same-version reports/approval, and prevents prerequisite removal. | Native PostgreSQL integration draft/empty refusals, finalized populated success, criterion insert/update/delete/TRUNCATE and content immutability cases; isolated rollback-only fixture with an `.invalid` source URL |
| M4 | Explicit current PEM CA trust, strict chain/hostname checks and immutable TLS settings on all non-test factory/CLI/DrizzleKit connections. Builds remain lazy. | `tests/database-tls.test.ts`: local generated certificates, valid handshake, wrong hostname, untrusted peer, missing/malformed/expired/future/non-CA trust anchor and downgrade refusal |
| L2 | Statement triggers refuse TRUNCATE of all eight history tables, including owner/CASCADE attempts. | Native database integration tests |
| L1 | Relative and alias public-db imports are refused; job imports are permitted only in jobs and actual private admin routes. | `tests/import-boundaries.test.ts`; ESLint |
| L10 | Consent acceptance/decline, recovery success/failure and sign-out use the configured canonical redirect origin. | `tests/accounts.integration.test.ts`, with hostile request/Host/forwarded-host fixtures |
| L9 | Already-verified TOTP users go from enrollment to localized verification with safe next handling; no-factor enrollment and ordinary-user refusal remain. | `tests/mfa-enrollment.test.ts`; no live provider/TOTP session used |

## Migration and schema metadata

The new tracked migration is `drizzle/0005_pre_step_six_hardening.sql`.
`drizzle/meta/0005_snapshot.json` and `_journal.json` record the matching schema
state. No earlier migration is rewritten.

It adds `production_blocked` to methodology, methodology version and source,
adds the persisted share constraint, and installs production/history triggers.
Prerequisite writes on methodology/version/criterion/source/report/audit tables require
READ COMMITTED and share an advisory transaction lock. Higher snapshot isolation
is refused because waiting on the lock cannot refresh a stale snapshot.
Production eligibility requires the approved workflow state and at least one
criterion. Mutable drafts and empty versions remain ineligible even with linked
approval metadata. Finalized criteria/content cannot be rewritten or truncated.
This is metadata integrity, not automated document verification.
The migration refuses pre-existing enabled records lacking prerequisites; an
operator must review and resolve those deliberately. It never auto-demotes them.

No production methodology was enabled or sourced. Success fixtures use invented
non-demo metadata solely inside a local transaction that is rolled back.

## Non-secret CA configuration and rollout

1. Obtain the current public database CA certificate/bundle from the intended
   Supabase project's official connection/security information. Verify the
   issuing source and validity dates. Do not use a private key or service-role key.
2. Supply the complete PEM certificate text as `SUPABASE_DB_CA_CERT` in each
   environment that actually connects. `.env.example` lists only the name and a
   comment; this task does not set an environment value. A missing/invalid/expired
   CA fails on first connection, not during imports or schema generation.
3. Keep the existing URLs, explicit hosts/ports and role-prefixed usernames:
   migrations use Session port 5432 (`postgres.`); app/public now also use Session
   port 5432 (`suhail_app.` / `suhail_public.`), all on `.pooler.supabase.com`
   (D-139 supersedes the previous runtime Transaction guidance).
   Never deploy the migration credential or workspace-only Supabase secret key.
4. Before the next release, obtain approval to review/apply the new migration to
   the intended external database. Check existing enabled-state prerequisites
   first, then run authorized read-only TLS/role smoke checks. Do not run the
   integration suite against Supabase or any persistent database.
5. Rotate the public CA configuration before expiry or a Supabase trust change.
   Do not bypass verification with encryption-only TLS or `ssl:false`.

## Verification boundary

Engine/unit tests, local TLS peers, native disposable PostgreSQL 17 and local
production HTTP/browser checks are separate from live Supabase verification.
The integration target is loopback `127.0.0.1:55432`, database `suhail_test`.
The harness uses neither migrations credentials nor any external host.
No live migration, seed, provider configuration, Google sign-in, real TOTP
ceremony, deployment or external environment change is performed here.
These local results do not claim that live signed-in UI or an external migration
has been verified.

### Measured local results

| Check | Result |
| --- | --- |
| Engine | 201 tests passed; 100% statements, branches, functions and lines |
| Unit suite | 525 tests passed across 23 files |
| Native PostgreSQL integration | 134 tests passed across 2 files, on a fresh disposable loopback cluster |
| Production HTTP/browser | 3 tests passed, including encoded paths, private nonce CSP/theme and public cookie-free ISR |
| TypeScript, ESLint and logical lint | Passed |
| Production build | Passed; no database connection or CA configuration was needed |
